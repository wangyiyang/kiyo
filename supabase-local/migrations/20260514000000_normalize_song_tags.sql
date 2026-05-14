-- 清洗 songs 表中的 genre 和 mood 字段
-- 策略：
-- 1. 去前后空格，转小写
-- 2. 中文标签映射到英文
-- 3. 复合标签（含逗号）保留第一部分

-- 先创建一个辅助函数用于标签标准化
CREATE OR REPLACE FUNCTION normalize_song_tag(tag text)
RETURNS text AS $$
DECLARE
  cleaned text;
BEGIN
  IF tag IS NULL OR trim(tag) = '' THEN
    RETURN NULL;
  END IF;

  -- 去空格转小写
  cleaned := lower(trim(tag));

  -- 中文映射
  IF cleaned = '伤感' THEN RETURN 'sentimental'; END IF;
  IF cleaned = '流行' THEN RETURN 'pop'; END IF;
  IF cleaned = '悲伤' THEN RETURN 'melancholic'; END IF;
  IF cleaned = '快乐' THEN RETURN 'happy'; END IF;
  IF cleaned = '兴奋' THEN RETURN 'energetic'; END IF;
  IF cleaned = '安静' THEN RETURN 'peaceful'; END IF;
  IF cleaned = '温柔' THEN RETURN 'warm'; END IF;

  -- 复合标签处理：保留逗号前第一部分
  IF position(',' in cleaned) > 0 THEN
    cleaned := trim(split_part(cleaned, ',', 1));
  END IF;

  -- 去除多余空格
  cleaned := regexp_replace(cleaned, '[[:space:]]+', ' ', 'g');

  RETURN cleaned;
END;
$$ LANGUAGE plpgsql;

-- 更新 genre 字段
UPDATE songs
SET genre = normalize_song_tag(genre)
WHERE genre IS NOT NULL;

-- 更新 mood 字段
UPDATE songs
SET mood = normalize_song_tag(mood)
WHERE mood IS NOT NULL;

-- 清理辅助函数（migration 完成后不再需要）
DROP FUNCTION IF EXISTS normalize_song_tag(text);
