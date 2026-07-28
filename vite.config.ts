import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { createCommunityServerPlugin } from './src/server/community-server-plugin'

// 이 브랜치는 커뮤니티 기능만 독립적으로 실행하기 위한 최소 구성입니다.
// agent_and_ui 브랜치와 합칠 때는 그쪽 vite.config.ts에 createCommunityServerPlugin()만
// plugins 배열에 추가하면 됩니다.
export default defineConfig({
  plugins: [react(), createCommunityServerPlugin()],
})
