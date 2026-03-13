// 環境別設定ファイル

export interface EnvironmentConfig {
  environment: string;
  domain: {
    root: string; // prance.jp (Route 53で管理)
    platform: string; // app.prance.jp
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

// ルートドメイン（Route 53で管理）
export const ROOT_DOMAIN = 'prance.jp';

// プラットフォームドメイン（サブドメイン）
export const PLATFORM_DOMAIN = 'app.prance.jp';

export const getConfig = (environment: string): EnvironmentConfig => {
  const configs: Record<string, EnvironmentConfig> = {
    dev: {
      environment: 'dev',
      domain: {
        root: ROOT_DOMAIN,
        platform: PLATFORM_DOMAIN,
        subdomain: 'dev.app',
        fullDomain: `dev.app.${ROOT_DOMAIN}`,
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
        subdomain: 'staging.app',
        fullDomain: `staging.app.${ROOT_DOMAIN}`,
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
        subdomain: 'app',
        fullDomain: `app.${ROOT_DOMAIN}`,
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
