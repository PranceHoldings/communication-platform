import { PrismaClient } from '.prisma/client';

const prisma = new PrismaClient();

const missingConfigs = [
  // AUDIO_PROCESSING
  {
    key: 'TTS_STABILITY',
    value: 0.5,
    dataType: 'NUMBER' as const,
    category: 'AUDIO_PROCESSING' as const,
    accessLevel: 'CLIENT_ADMIN_READ_WRITE' as const,
    defaultValue: 0.5,
    minValue: 0.3,
    maxValue: 1.0,
    description: 'TTS stability parameter (minimum 0.3 for audio stability)',
  },
  {
    key: 'TTS_SIMILARITY_BOOST',
    value: 0.75,
    dataType: 'NUMBER' as const,
    category: 'AUDIO_PROCESSING' as const,
    accessLevel: 'CLIENT_ADMIN_READ_WRITE' as const,
    defaultValue: 0.75,
    minValue: 0.5,
    maxValue: 1.0,
    description: 'TTS similarity boost parameter (minimum 0.5 for voice quality)',
  },
  {
    key: 'SILENCE_THRESHOLD',
    value: 0.15,
    dataType: 'NUMBER' as const,
    category: 'AUDIO_PROCESSING' as const,
    accessLevel: 'CLIENT_ADMIN_READ_WRITE' as const,
    defaultValue: 0.15,
    minValue: 0.0,
    maxValue: 0.3,
    description: 'Silence detection threshold (maximum 0.3 to avoid missing speech)',
  },
  {
    key: 'OPTIMAL_PAUSE_SEC',
    value: 2.0,
    dataType: 'NUMBER' as const,
    category: 'AUDIO_PROCESSING' as const,
    accessLevel: 'CLIENT_ADMIN_READ_WRITE' as const,
    defaultValue: 2.0,
    minValue: 1.0,
    maxValue: 5.0,
    description: 'Optimal pause duration in seconds',
  },
  // SCORE_CALCULATION - Component weights
  {
    key: 'AUDIO_WEIGHT',
    value: 0.25,
    dataType: 'NUMBER' as const,
    category: 'SCORE_CALCULATION' as const,
    accessLevel: 'CLIENT_ADMIN_READ_WRITE' as const,
    defaultValue: 0.25,
    minValue: 0.0,
    maxValue: 1.0,
    description: 'Audio quality weight (must sum to 1.0 with other weights)',
  },
  {
    key: 'CONTENT_WEIGHT',
    value: 0.25,
    dataType: 'NUMBER' as const,
    category: 'SCORE_CALCULATION' as const,
    accessLevel: 'CLIENT_ADMIN_READ_WRITE' as const,
    defaultValue: 0.25,
    minValue: 0.0,
    maxValue: 1.0,
    description: 'Content quality weight (must sum to 1.0 with other weights)',
  },
  {
    key: 'DELIVERY_WEIGHT',
    value: 0.25,
    dataType: 'NUMBER' as const,
    category: 'SCORE_CALCULATION' as const,
    accessLevel: 'CLIENT_ADMIN_READ_WRITE' as const,
    defaultValue: 0.25,
    minValue: 0.0,
    maxValue: 1.0,
    description: 'Delivery quality weight (must sum to 1.0 with other weights)',
  },
  {
    key: 'EMOTION_WEIGHT',
    value: 0.25,
    dataType: 'NUMBER' as const,
    category: 'SCORE_CALCULATION' as const,
    accessLevel: 'CLIENT_ADMIN_READ_WRITE' as const,
    defaultValue: 0.25,
    minValue: 0.0,
    maxValue: 1.0,
    description: 'Emotion analysis weight (must sum to 1.0 with other weights)',
  },
];

async function main() {
  console.log('🔄 Seeding missing runtime configurations...\n');

  let inserted = 0;
  let updated = 0;

  for (const config of missingConfigs) {
    try {
      const existing = await prisma.runtimeConfig.findUnique({
        where: { key: config.key },
      });

      if (existing) {
        await prisma.runtimeConfig.update({
          where: { key: config.key },
          data: {
            dataType: config.dataType,
            category: config.category,
            accessLevel: config.accessLevel,
            defaultValue: config.defaultValue,
            minValue: config.minValue,
            maxValue: config.maxValue,
            description: config.description,
          },
        });
        console.log(`✅ Updated: ${config.key}`);
        updated++;
      } else {
        await prisma.runtimeConfig.create({
          data: {
            key: config.key,
            value: config.value,
            dataType: config.dataType,
            category: config.category,
            accessLevel: config.accessLevel,
            defaultValue: config.defaultValue,
            minValue: config.minValue,
            maxValue: config.maxValue,
            description: config.description,
          },
        });
        console.log(`✅ Inserted: ${config.key}`);
        inserted++;
      }
    } catch (error) {
      console.error(`❌ Error with ${config.key}:`, error);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Total: ${inserted + updated}`);

  // Verify final count
  const total = await prisma.runtimeConfig.count();
  const byCategory = await prisma.runtimeConfig.groupBy({
    by: ['category'],
    _count: true,
  });

  console.log(`\n📈 Final database state:`);
  console.log(`   Total configs: ${total}`);
  console.log(`   By category:`);
  byCategory.forEach((cat: any) => {
    console.log(`     - ${cat.category}: ${cat._count}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
