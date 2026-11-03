import { defineRailway, project, service, volume } from "railway/iac";

// This file only manages the resources it declares. Anything else in the Railway project
// (for example the generated *.up.railway.app domain) is left alone.
export const partial = "jaew-guesthouse";

export default defineRailway(() => {
  // ALL business data lives on this volume: settings, booking ledger, uploaded room photos,
  // daily backups. Never remove it from this file - removing it would delete the data.
  const jaewGuesthouseVolume = volume("jaew-guesthouse-volume", {
    alerts: { usage: { "100": {}, "80": {}, "95": {} } },
    allowOnlineResize: true,
    region: "asia-southeast1-eqsg3a",
    sizeMB: 500,
  });

  const jaewGuesthouse = service("jaew-guesthouse", {
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    deploy: {
      healthcheckPath: "/api/health",
      healthcheckTimeout: 120,
      // Railway's IaC does not persist this field yet; it was set directly on the service via the API.
      restartPolicyType: "ALWAYS",
    },
    // Exactly one copy, in Singapore. Two copies would each keep their own separate data.
    replicas: { "asia-southeast1-eqsg3a": 1 },
    volumeMounts: { "/data": jaewGuesthouseVolume },
  });

  return project("jaew-guesthouse", {
    variables: { managed: false },
    resources: [jaewGuesthouse, jaewGuesthouseVolume],
  });
});
