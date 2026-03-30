-- Seed Test Recording Data
-- Adds recording, transcripts, and analysis data to an existing COMPLETED session

-- Variables (replace with actual session ID)
-- Session ID: f839e789-e5ae-4e39-b184-d975d6e7029f

-- 1. Insert Recording
INSERT INTO recordings (
  id,
  session_id,
  type,
  s3_key,
  s3_url,
  cdn_url,
  file_size_bytes,
  duration_sec,
  duration_ms,
  format,
  resolution,
  video_chunks_count,
  processing_status,
  processed_at,
  created_at
) VALUES (
  gen_random_uuid(),
  'f839e789-e5ae-4e39-b184-d975d6e7029f',
  'COMBINED',
  'recordings/f839e789-e5ae-4e39-b184-d975d6e7029f/combined-test.webm',
  'https://prance-dev-recordings.s3.us-east-1.amazonaws.com/recordings/f839e789-e5ae-4e39-b184-d975d6e7029f/combined-test.webm',
  'https://d3mx0sug5s3a6x.cloudfront.net/recordings/f839e789-e5ae-4e39-b184-d975d6e7029f/combined-test.webm',
  5242880,
  120,
  120000,
  'webm',
  '1280x720',
  24,
  'COMPLETED',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- 2. Insert Transcripts
INSERT INTO transcripts (id, session_id, speaker, text, timestamp_start, timestamp_end, confidence) VALUES
(gen_random_uuid(), 'f839e789-e5ae-4e39-b184-d975d6e7029f', 'AI', 'こんにちは。今日は面接にお越しいただき、ありがとうございます。まず自己紹介をお願いします。', 0.5, 6.2, 0.95),
(gen_random_uuid(), 'f839e789-e5ae-4e39-b184-d975d6e7029f', 'USER', 'はい、よろしくお願いします。私は5年間ソフトウェアエンジニアとして働いており、特にWebアプリケーション開発が得意です。', 7.0, 15.5, 0.92),
(gen_random_uuid(), 'f839e789-e5ae-4e39-b184-d975d6e7029f', 'AI', 'ありがとうございます。それでは、あなたの強みについて教えてください。', 16.0, 20.8, 0.96),
(gen_random_uuid(), 'f839e789-e5ae-4e39-b184-d975d6e7029f', 'USER', '私の強みは、新しい技術を素早く学習し、チームと協力して問題を解決できることです。', 21.5, 29.2, 0.89),
(gen_random_uuid(), 'f839e789-e5ae-4e39-b184-d975d6e7029f', 'AI', '素晴らしいですね。では、過去のプロジェクトで最も困難だったことは何ですか？', 30.0, 36.5, 0.94),
(gen_random_uuid(), 'f839e789-e5ae-4e39-b184-d975d6e7029f', 'USER', 'レガシーシステムの大規模なリファクタリングプロジェクトです。多くの依存関係があり、段階的なアプローチが必要でした。', 37.2, 47.8, 0.91),
(gen_random_uuid(), 'f839e789-e5ae-4e39-b184-d975d6e7029f', 'AI', 'どのようにその課題を克服しましたか？', 48.5, 52.0, 0.97),
(gen_random_uuid(), 'f839e789-e5ae-4e39-b184-d975d6e7029f', 'USER', 'チームで詳細な計画を立て、自動テストを整備し、小さな変更を積み重ねていきました。結果として、安全にシステムを刷新できました。', 52.8, 65.5, 0.93)
ON CONFLICT DO NOTHING;

-- 3. Insert Session Score
INSERT INTO session_scores (
  id,
  session_id,
  overall_score,
  emotion_score,
  audio_score,
  content_score,
  delivery_score,
  emotion_stability,
  emotion_positivity,
  confidence,
  engagement,
  clarity,
  fluency,
  pacing,
  volume,
  relevance,
  structure,
  completeness,
  strengths,
  improvements,
  criteria,
  weights,
  version,
  calculated_at
) VALUES (
  gen_random_uuid(),
  'f839e789-e5ae-4e39-b184-d975d6e7029f',
  78.5,
  82.0,
  75.5,
  80.0,
  77.0,
  85.0,
  79.0,
  76.0,
  83.0,
  72.0,
  78.0,
  75.0,
  76.5,
  82.0,
  79.5,
  78.5,
  '["良好な感情コントロール","適切な話速","明確な論理構造"]'::json,
  '["フィラー語を減らす","音量を少し上げる","より具体的な例を挙げる"]'::json,
  '{"emotion":"AWS Rekognition による感情解析","audio":"Azure Speech Services による音声解析","content":"Claude Sonnet による内容解析"}'::json,
  '{"emotion":0.25,"audio":0.25,"content":0.30,"delivery":0.20}'::json,
  '1.0',
  NOW()
) ON CONFLICT (session_id) DO NOTHING;

-- 4. Insert Emotion Analyses
WITH recording_id AS (
  SELECT id FROM recordings WHERE session_id = 'f839e789-e5ae-4e39-b184-d975d6e7029f' LIMIT 1
)
INSERT INTO emotion_analyses (
  id, session_id, recording_id, timestamp, emotions, dominant_emotion, confidence,
  eyes_open, eyes_open_confidence, mouth_open, mouth_open_confidence,
  pose, brightness, sharpness, created_at
)
SELECT
  gen_random_uuid(),
  'f839e789-e5ae-4e39-b184-d975d6e7029f',
  recording_id.id,
  data.timestamp,
  data.emotions::json,
  data.dominant_emotion,
  data.confidence,
  TRUE, 95.0, FALSE, 90.0,
  '{"Pitch": 0.5, "Roll": -1.2, "Yaw": 2.1}'::json,
  75.5, 82.3, NOW()
FROM recording_id,
(VALUES
  (5.0,  '[{"Type":"CALM","Confidence":85.5},{"Type":"HAPPY","Confidence":12.3}]', 'CALM', 85.5),
  (15.0, '[{"Type":"HAPPY","Confidence":78.2},{"Type":"CALM","Confidence":19.5}]', 'HAPPY', 78.2),
  (30.0, '[{"Type":"CONFUSED","Confidence":42.1},{"Type":"CALM","Confidence":38.9}]', 'CONFUSED', 42.1),
  (50.0, '[{"Type":"CALM","Confidence":88.7},{"Type":"HAPPY","Confidence":9.2}]', 'CALM', 88.7)
) AS data(timestamp, emotions, dominant_emotion, confidence)
ON CONFLICT DO NOTHING;

-- 5. Insert Audio Analyses
INSERT INTO audio_analyses (
  id, session_id, timestamp, pitch, pitch_variance, volume, volume_variance,
  speaking_rate, pause_count, pause_duration, clarity, confidence, snr,
  filler_words, filler_count, duration, created_at
)
SELECT
  gen_random_uuid(),
  'f839e789-e5ae-4e39-b184-d975d6e7029f',
  data.timestamp,
  data.pitch, 15.2, data.volume, 3.5,
  data.speaking_rate, data.pause_count, 0.8, data.clarity, 0.92, 25.5,
  '["ええと","あの"]'::json, data.filler_count, 5.0, NOW()
FROM (VALUES
  (10.0, 185.5, -18.2, 145.0, 2, 0.85, 1),
  (25.0, 192.3, -16.8, 152.0, 3, 0.82, 2),
  (40.0, 178.1, -19.5, 138.0, 4, 0.79, 3),
  (60.0, 188.7, -17.3, 148.0, 2, 0.87, 1)
) AS data(timestamp, pitch, volume, speaking_rate, pause_count, clarity, filler_count)
ON CONFLICT DO NOTHING;

-- Verification
SELECT 'Seeding completed!' AS message;
SELECT
  (SELECT COUNT(*) FROM recordings WHERE session_id = 'f839e789-e5ae-4e39-b184-d975d6e7029f') AS recordings_count,
  (SELECT COUNT(*) FROM transcripts WHERE session_id = 'f839e789-e5ae-4e39-b184-d975d6e7029f') AS transcripts_count,
  (SELECT COUNT(*) FROM session_scores WHERE session_id = 'f839e789-e5ae-4e39-b184-d975d6e7029f') AS scores_count,
  (SELECT COUNT(*) FROM emotion_analyses WHERE session_id = 'f839e789-e5ae-4e39-b184-d975d6e7029f') AS emotion_analyses_count,
  (SELECT COUNT(*) FROM audio_analyses WHERE session_id = 'f839e789-e5ae-4e39-b184-d975d6e7029f') AS audio_analyses_count;
