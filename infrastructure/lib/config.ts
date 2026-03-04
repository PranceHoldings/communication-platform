// 環境別設定ファイル

export interface EnvironmentConfig {
  environment: string;
  domain: {
    root: string;              // prance.co.jp (お名前.comで管理)
    platform: string;          // platform.prance.co.jp (Route 53で管理) ★NEW
    subdomain: string;
    fullDomain: string;
  };
  aurora: {
    minCapacity: number;
    maxCapacity: number;
    backupRetentionDays: number;
  };
  lambda: {
    logRetentionDays: number;
  };
  s3: {
    recordingsLifecycleDays: number;
  };
  tags: {
    Environment: string;
    CostCenter: string;
  };
}

// ルートドメイン（お名前.comで管理）
export const ROOT_DOMAIN = 'prance.co.jp';

// プラットフォームドメイン（Route 53で管理、サブドメイン委譲方式）
export const PLATFORM_DOMAIN = 'platform.prance.co.jp';

export const getConfig = (environment: string): EnvironmentConfig => {
  const configs: Record<string, EnvironmentConfig> = {
    dev: {
      environment: 'dev',
      domain: {
        root: ROOT_DOMAIN,
        platform: PLATFORM_DOMAIN,
        subdomain: 'dev.platform',
        fullDomain: `dev.platform.${ROOT_DOMAIN}`,
      },
      aurora: {
        minCapacity: 0.5,
        maxCapacity: 2,
        backupRetentionDays: 1,
      },
      lambda: {
        logRetentionDays: 7,
      },
      s3: {
        recordingsLifecycleDays: 7,
      },
      tags: {
        Environment: 'Development',
        CostCenter: 'Engineering',
      },
    },
    staging: {
      environment: 'staging',
      domain: {
        root: ROOT_DOMAIN,
        platform: PLATFORM_DOMAIN,
        subdomain: 'staging.platform',
        fullDomain: `staging.platform.${ROOT_DOMAIN}`,
      },
      aurora: {
        minCapacity: 0.5,
        maxCapacity: 4,
        backupRetentionDays: 3,
      },
      lambda: {
        logRetentionDays: 14,
      },
      s3: {
        recordingsLifecycleDays: 30,
      },
      tags: {
        Environment: 'Staging',
        CostCenter: 'Engineering',
      },
    },
    production: {
      environment: 'production',
      domain: {
        root: ROOT_DOMAIN,
        platform: PLATFORM_DOMAIN,
        subdomain: 'platform',
        fullDomain: `platform.${ROOT_DOMAIN}`,
      },
      aurora: {
        minCapacity: 0.5,
        maxCapacity: 16,
        backupRetentionDays: 7,
      },
      lambda: {
        logRetentionDays: 30,
      },
      s3: {
        recordingsLifecycleDays: 90,
      },
      tags: {
        Environment: 'Production',
        CostCenter: 'Operations',
      },
    },
  };

  const config = configs[environment];
  if (!config) {
    throw new Error(
      `Invalid environment: ${environment}. Must be one of: dev, staging, production`
    );
  }

  return config;
};
