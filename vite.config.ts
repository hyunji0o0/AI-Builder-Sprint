import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { createAgentServerPlugin } from './src/agent/server/vite-agent-plugin'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  return {
    plugins: [
      react(),
      createAgentServerPlugin({
        apiKey: env.UPSTAGE_API_KEY,
        model: env.UPSTAGE_MODEL || 'solar-pro3',
        agentMockMode: env.AGENT_MOCK_MODE === 'true',
        documentPipeline: {
          mode: env.DOCUMENT_PIPELINE_MODE === 'live' ? 'live' : 'mock',
          environment: mode,
          allowMockInProduction: env.ALLOW_MOCK_DOCUMENT_PIPELINE_IN_PRODUCTION === 'true',
        },
      }),
    ],
  }
})
