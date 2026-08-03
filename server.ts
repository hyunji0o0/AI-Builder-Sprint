import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createAgentServerPlugin } from './src/agent/server/vite-agent-plugin';
import { createCommunityServerPlugin } from './src/server/community-server-plugin';

// .env.local 로딩 (Supabase 및 Upstage 키 등)
dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Vite 플러그인이 미들웨어를 등록할 수 있도록 Mock Vite Server 객체 생성
const viteServerMock = { middlewares: app } as any;

// 1. 에이전트 미들웨어 세팅 (/api/agent, /api/documents)
const agentPlugin = createAgentServerPlugin({
  apiKey: process.env.UPSTAGE_API_KEY || '',
  model: process.env.UPSTAGE_MODEL || 'solar-pro3',
  simpleModel: process.env.UPSTAGE_SIMPLE_MODEL || 'solar-mini',
  documentPipeline: {
    mode: 'python',
    environment: 'production',
    pythonCommand: process.env.PYTHON_COMMAND || undefined,
  },
});
if (agentPlugin.configureServer) {
  agentPlugin.configureServer(viteServerMock);
}

// 2. 커뮤니티 엔진 미들웨어 세팅 (/api/community/*)
const communityPlugin = createCommunityServerPlugin();
if (communityPlugin.configureServer) {
  communityPlugin.configureServer(viteServerMock);
}

// 3. 프론트엔드 정적 파일 서빙 세팅
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, 'dist');

app.use(express.static(distPath));

// React SPA 라우팅 처리: 명시된 API 이외의 모든 경로는 index.html로 폴백
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`=========================================`);
  console.log(`🚀 Production Server is running!`);
  console.log(`📡 URL: http://0.0.0.0:${port}`);
  console.log(`=========================================`);
});
