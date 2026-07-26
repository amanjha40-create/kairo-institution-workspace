import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  preset: process.env.NITRO_PRESET,
  awsAmplify: {
    runtime: "nodejs22.x",
  },
});
