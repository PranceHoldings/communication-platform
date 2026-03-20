import crypto from 'crypto';

export interface ProfileAttributes {
  scenarioId: string;
  userAge?: number;
  userGender?: string;
  userExperience?: string;
  userIndustry?: string;
  userRole?: string;
  // 将来拡張可能（追加の属性）
}

/**
 * プロファイルハッシュを生成
 *
 * 同一条件のユーザーグループを識別するための一意ハッシュ
 * SHA256を使用してプライバシーを保護
 *
 * @param attributes - ユーザーのプロファイル属性
 * @returns SHA256ハッシュ（64文字の16進数文字列）
 *
 * @example
 * const hash = generateProfileHash({
 *   scenarioId: 'scenario-123',
 *   userAge: 28,
 *   userGender: 'female',
 *   userExperience: 'intermediate'
 * });
 * // => "a3f5c8d9e1b2..." (64 chars)
 */
export function generateProfileHash(attributes: ProfileAttributes): string {
  // 正規化された属性オブジェクト
  const normalized = {
    scenarioId: attributes.scenarioId,
    age: normalizeAge(attributes.userAge),
    gender: normalizeGender(attributes.userGender),
    experience: normalizeExperience(attributes.userExperience),
    industry: normalizeIndustry(attributes.userIndustry),
    role: normalizeRole(attributes.userRole),
  };

  // ソート済みキーでJSON文字列化（一貫性を保証）
  const hashInput = JSON.stringify(normalized, Object.keys(normalized).sort());

  // SHA256ハッシュ生成
  return crypto.createHash('sha256').update(hashInput, 'utf8').digest('hex');
}

/**
 * 年齢を年代に正規化（k-anonymity向上）
 *
 * 目的：
 * - 細かい年齢差をグループ化してサンプル数を増やす
 * - プライバシー保護（年代までの粒度に下げる）
 */
function normalizeAge(age?: number): string {
  if (!age || age < 0) return 'unknown';
  if (age < 20) return 'teens'; // 10代
  if (age < 30) return '20s'; // 20代
  if (age < 40) return '30s'; // 30代
  if (age < 50) return '40s'; // 40代
  if (age < 60) return '50s'; // 50代
  return '60+'; // 60代以上
}

/**
 * 性別を正規化
 */
function normalizeGender(gender?: string): string {
  if (!gender) return 'unknown';

  const normalized = gender.toLowerCase().trim();

  if (normalized === 'male' || normalized === 'm' || normalized === '男性') return 'male';
  if (normalized === 'female' || normalized === 'f' || normalized === '女性') return 'female';
  if (normalized === 'other' || normalized === 'その他') return 'other';
  if (normalized === 'prefer_not_to_say' || normalized === '回答しない') return 'prefer_not_to_say';

  return 'unknown';
}

/**
 * 経験レベルを正規化
 */
function normalizeExperience(experience?: string): string {
  if (!experience) return 'unknown';

  const normalized = experience.toLowerCase().trim();

  // Beginner / 初心者
  if (
    normalized === 'beginner' ||
    normalized === 'novice' ||
    normalized === '初心者' ||
    normalized === '新人'
  )
    return 'beginner';

  // Intermediate / 中級者
  if (
    normalized === 'intermediate' ||
    normalized === 'mid-level' ||
    normalized === '中級者' ||
    normalized === '中堅'
  )
    return 'intermediate';

  // Advanced / 上級者
  if (
    normalized === 'advanced' ||
    normalized === 'senior' ||
    normalized === 'expert' ||
    normalized === '上級者' ||
    normalized === 'シニア'
  )
    return 'advanced';

  return 'unknown';
}

/**
 * 業界を正規化
 */
function normalizeIndustry(industry?: string): string {
  if (!industry) return 'unknown';

  const normalized = industry.toLowerCase().trim();

  // IT / Technology
  if (
    normalized.includes('it') ||
    normalized.includes('tech') ||
    normalized.includes('software') ||
    normalized.includes('エンジニア')
  )
    return 'technology';

  // Finance / 金融
  if (
    normalized.includes('finance') ||
    normalized.includes('bank') ||
    normalized.includes('金融') ||
    normalized.includes('銀行')
  )
    return 'finance';

  // Healthcare / 医療
  if (
    normalized.includes('healthcare') ||
    normalized.includes('medical') ||
    normalized.includes('医療') ||
    normalized.includes('病院')
  )
    return 'healthcare';

  // Education / 教育
  if (
    normalized.includes('education') ||
    normalized.includes('school') ||
    normalized.includes('教育') ||
    normalized.includes('学校')
  )
    return 'education';

  // Retail / 小売
  if (normalized.includes('retail') || normalized.includes('小売') || normalized.includes('販売'))
    return 'retail';

  // Manufacturing / 製造
  if (
    normalized.includes('manufacturing') ||
    normalized.includes('factory') ||
    normalized.includes('製造') ||
    normalized.includes('工場')
  )
    return 'manufacturing';

  // Other
  return 'other';
}

/**
 * 役職を正規化
 */
function normalizeRole(role?: string): string {
  if (!role) return 'unknown';

  const normalized = role.toLowerCase().trim();

  // Entry Level / 一般社員
  if (
    normalized.includes('entry') ||
    normalized.includes('junior') ||
    normalized.includes('staff') ||
    normalized.includes('一般') ||
    normalized.includes('社員')
  )
    return 'entry_level';

  // Mid Level / 中間管理職
  if (
    normalized.includes('mid') ||
    normalized.includes('senior') ||
    normalized.includes('lead') ||
    normalized.includes('主任') ||
    normalized.includes('リーダー')
  )
    return 'mid_level';

  // Manager / 管理職
  if (
    normalized.includes('manager') ||
    normalized.includes('director') ||
    normalized.includes('マネージャー') ||
    normalized.includes('管理職') ||
    normalized.includes('課長')
  )
    return 'manager';

  // Executive / 役員
  if (
    normalized.includes('executive') ||
    normalized.includes('vp') ||
    normalized.includes('ceo') ||
    normalized.includes('cto') ||
    normalized.includes('役員') ||
    normalized.includes('部長')
  )
    return 'executive';

  return 'unknown';
}

/**
 * プロファイルハッシュの検証
 *
 * @param hash - 検証するハッシュ文字列
 * @returns ハッシュが有効な場合true
 */
export function isValidProfileHash(hash: string): boolean {
  // SHA256ハッシュは64文字の16進数
  return /^[a-f0-9]{64}$/.test(hash);
}

/**
 * プロファイル属性からグループサイズの推定
 *
 * k-anonymityチェック用：推定グループサイズがk未満の場合、
 * より粗い粒度に調整することを推奨
 *
 * @param attributes - プロファイル属性
 * @returns 推定グループサイズ（実際の計算には使用しない、あくまで目安）
 */
export function estimateGroupSize(attributes: ProfileAttributes): number {
  // 簡易的な推定：各属性の粒度から推定
  let multiplier = 1;

  // シナリオは固定（粒度に影響しない）
  // multiplier *= 1;

  // 年齢（6グループ）
  if (attributes.userAge !== undefined) multiplier *= 6;

  // 性別（4グループ）
  if (attributes.userGender !== undefined) multiplier *= 4;

  // 経験レベル（3グループ）
  if (attributes.userExperience !== undefined) multiplier *= 3;

  // 業界（7グループ）
  if (attributes.userIndustry !== undefined) multiplier *= 7;

  // 役職（4グループ）
  if (attributes.userRole !== undefined) multiplier *= 4;

  // 総ユーザー数を仮定（例：1000ユーザー）
  const totalUsers = 1000;
  const estimatedGroupSize = Math.floor(totalUsers / multiplier);

  return Math.max(1, estimatedGroupSize);
}
