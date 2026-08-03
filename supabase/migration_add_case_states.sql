-- 사용자별 사건 상태를 영속적으로 저장하는 테이블
CREATE TABLE IF NOT EXISTS case_states (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state    JSONB NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 활성화: 자기 자신의 row만 읽고 쓸 수 있음
ALTER TABLE case_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own case state"
  ON case_states FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
