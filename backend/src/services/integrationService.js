import { readdir, readFile, copyFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INTEGRATIONS_DIR = path.resolve(__dirname, "../../integrations/printers");

export async function listTypes() {
  try {
    const files = await readdir(INTEGRATIONS_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    const types = await Promise.all(
      jsonFiles.map(async (file) => {
        const content = await readFile(
          path.join(INTEGRATIONS_DIR, file),
          "utf-8",
        );
        const config = JSON.parse(content);
        return {
          id: config.id,
          name: config.name,
          version: config.version,
          description: config.description,
          connectionFields: config.connection_fields || [],
          capabilities: config.capabilities || {},
          statusDisplayLabels: config.status_display_labels || {},
        };
      }),
    );
    return types;
  } catch {
    return [];
  }
}

export async function getIntegration(typeId) {
  try {
    const filePath = path.join(INTEGRATIONS_DIR, `${typeId}.json`);
    const content = await readFile(filePath, "utf-8");
    const config = JSON.parse(content);
    return buildIntegrationAdapter(config);
  } catch {
    return null;
  }
}

export async function getTypeStatus(typeId) {
  const integration = await getIntegration(typeId);
  if (!integration)
    return { typeId, valid: false, message: "Integration config not found" };
  return { typeId, valid: true };
}

export async function installConfig(uploadedFilePath) {
  const content = await readFile(uploadedFilePath, "utf-8");
  const config = JSON.parse(content);

  if (!config.id || !config.name) {
    throw Object.assign(
      new Error("Invalid integration config: missing id or name"),
      { status: 400 },
    );
  }

  const dest = path.join(INTEGRATIONS_DIR, `${config.id}.json`);
  await copyFile(uploadedFilePath, dest);
  return { id: config.id, name: config.name, installed: true };
}

function buildIntegrationAdapter(config) {
  async function fetchEndpoint(connectionDetails, endpointKey) {
    const endpoint = config.api.endpoints[endpointKey];
    if (!endpoint) return null;

    const baseUrl = connectionDetails.base_url || config.api.base_url;
    // Replace path parameters like {printer_uuid} from connectionDetails
    const resolvedEndpoint = endpoint.replace(/\{(\w+)\}/g, (_, key) => connectionDetails[key] || "");
    const url = `${baseUrl}${resolvedEndpoint}`;
    const headers = { ...config.api.request_options?.headers };

    if (config.api.authentication.type === "apiKey" && connectionDetails.apiKey) {
      const scheme = config.api.authentication.scheme || "Bearer";
      headers["Authorization"] = `${scheme} ${connectionDetails.apiKey}`;
    } else if (config.api.authentication.type === "headerKey" && connectionDetails.apiKey) {
      // Custom header key auth — used by PrusaLink (X-Api-Key) and similar local APIs
      const headerName = config.api.authentication.header || "X-Api-Key";
      headers[headerName] = connectionDetails.apiKey;
    } else if (config.api.authentication.type === "basicAuth" && connectionDetails.username) {
      const encoded = Buffer.from(`${connectionDetails.username}:${connectionDetails.password || ""}`).toString("base64");
      headers["Authorization"] = `Basic ${encoded}`;
    }

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(
        (config.api.request_options?.timeout_seconds || 10) * 1000,
      ),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function resolvePath(obj, dotPath, defaultValue) {
    return (
      dotPath.split(".").reduce((acc, key) => {
        if (key === "response") return acc;
        if (key === "body") return acc;
        return acc?.[key];
      }, obj) ?? defaultValue
    );
  }

  return {
    async getStatus(connectionDetails) {
      const data = await fetchEndpoint(connectionDetails, "status");
      const raw = resolvePath(data, config.data_mapping.status.source, "UNKNOWN");
      return config.data_mapping.status.mapping?.[raw] || "UNKNOWN";
    },
    async getPrintProgress(connectionDetails) {
      const data = await fetchEndpoint(connectionDetails, "job_details");
      if (!data || !config.data_mapping.print_progress_percentage) return data;
      // Return structured job info when mapping is available
      return {
        raw: data,
        progress: resolvePath(data, config.data_mapping.print_progress_percentage.source,
          config.data_mapping.print_progress_percentage.default ?? null),
        timeRemaining: config.data_mapping.time_remaining_seconds
          ? resolvePath(data, config.data_mapping.time_remaining_seconds.source, null)
          : null,
        timePrinting: config.data_mapping.time_printing_seconds
          ? resolvePath(data, config.data_mapping.time_printing_seconds.source, null)
          : null,
        filament: config.data_mapping.filament_material
          ? resolvePath(data, config.data_mapping.filament_material.source, null)
          : null,
      };
    },
    async getPrinterModel(connectionDetails) {
      const data = await fetchEndpoint(connectionDetails, "printer_model");
      return resolvePath(
        data,
        config.data_mapping.printer_model?.source,
        config.data_mapping.printer_model?.default,
      );
    },
  };
}
