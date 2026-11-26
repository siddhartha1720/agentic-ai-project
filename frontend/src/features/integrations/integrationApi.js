import api from "@/api";

export const fetchIntegrationsApi = async () => {
  const response = await api.get("/api/integrations");
  return response.data;
};
