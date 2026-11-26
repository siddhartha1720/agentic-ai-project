import mongoose from "mongoose";
import CustomApiConnection from "../models/customApiConnection.model.js";
import { decrypt, encrypt } from "../utils/encrypt.js";

const PRIVATE_HOST =
  /^(localhost|.*\.local|.*\.internal|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$)/i;

const normalizeBaseUrl = (input) => {
  const url = new URL(String(input).trim());

  if (url.protocol !== "https:") {
    throw new Error("Base URL must use HTTPS.");
  }

  if (url.username || url.password) {
    throw new Error("Base URL must not contain credentials.");
  }

  if (PRIVATE_HOST.test(url.hostname)) {
    throw new Error("This host is not allowed.");
  }

  return url.origin;
};

const callErp = async (baseUrl, apiKey, apiSecret) => {
  const response = await fetch(
    `${baseUrl}/api/method/frappe.auth.get_logged_user`,
    {
      method: "GET",
      headers: {
        Authorization: `token ${apiKey}:${apiSecret}`,
        Accept: "application/json",
      },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    }
  );

  if (!response.ok) {
    throw new Error(`ERPNext responded with status ${response.status}.`);
  }

  return response.json();
};

const toSafeConnection = (connection) => ({
  id: connection._id,
  name: connection.name,
  provider: connection.provider,
  baseUrl: connection.baseUrl,
  status: connection.status,
  capabilities: connection.capabilities,
  metadata: connection.metadata,
  lastValidatedAt: connection.lastValidatedAt,
  lastUsedAt: connection.lastUsedAt,
  createdAt: connection.createdAt,
});

export const createConnection = async (req, res) => {
  try {
    const { name, baseUrl, apiKey, apiSecret } = req.body || {};

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 100 ||
      typeof baseUrl !== "string" ||
      typeof apiKey !== "string" ||
      !apiKey.trim() ||
      apiKey.length > 500 ||
      typeof apiSecret !== "string" ||
      !apiSecret.trim() ||
      apiSecret.length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid name, baseUrl, apiKey and apiSecret are required.",
      });
    }

    let origin;
    try {
      origin = normalizeBaseUrl(baseUrl);
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    let identity;
    try {
      identity = await callErp(origin, apiKey.trim(), apiSecret.trim());
    } catch {
      return res.status(400).json({
        success: false,
        message:
          "ERPNext rejected the credentials or the site is unreachable.",
      });
    }

    const connection = await CustomApiConnection.create({
      userId: req.user._id,
      name: name.trim(),
      provider: "erpnext",
      baseUrl: origin,
      auth: {
        type: "frappe_token",
        secretEncrypted: encrypt(
          JSON.stringify({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim() })
        ),
      },
      status: "connected",
      capabilities: ["employee:read"],
      metadata: {
        siteName: new URL(origin).hostname,
        connectedUser:
          typeof identity?.message === "string" ? identity.message : "",
      },
      lastValidatedAt: new Date(),
    });

    return res
      .status(201)
      .json({ success: true, connection: toSafeConnection(connection) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A connection with this name already exists.",
      });
    }

    console.error("Create custom API connection:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not save the connection.",
    });
  }
};

export const listConnections = async (req, res) => {
  try {
    const connections = await CustomApiConnection.find({
      userId: req.user._id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      connections: connections.map(toSafeConnection),
    });
  } catch (error) {
    console.error("List custom API connections:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not load connections.",
    });
  }
};

export const validateConnection = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid id." });
    }

    const connection = await CustomApiConnection.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).select("+auth.secretEncrypted");

    if (!connection) {
      return res
        .status(404)
        .json({ success: false, message: "Connection not found." });
    }

    try {
      const credentials = JSON.parse(decrypt(connection.auth.secretEncrypted));
      const identity = await callErp(
        connection.baseUrl,
        credentials.apiKey,
        credentials.apiSecret
      );

      connection.status = "connected";
      connection.metadata.connectedUser =
        typeof identity?.message === "string" ? identity.message : "";
      connection.lastValidatedAt = new Date();
    } catch {
      connection.status = "error";
    }

    await connection.save();

    return res.status(200).json({
      success: true,
      connection: toSafeConnection(connection),
    });
  } catch (error) {
    console.error("Validate custom API connection:", error.message);
    return res.status(500).json({
      success: false,
      message: "Validation failed.",
    });
  }
};

export const deleteConnection = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid id." });
    }

    const connection = await CustomApiConnection.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!connection) {
      return res
        .status(404)
        .json({ success: false, message: "Connection not found." });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Delete custom API connection:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not delete connection.",
    });
  }
};
