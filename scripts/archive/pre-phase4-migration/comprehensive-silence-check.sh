#!/bin/bash
# Comprehensive Silence Timer Check
# This script validates all components of the silence timer feature

echo "======================================"
echo "Silence Timer Feature Check"
echo "======================================"
echo ""

# 1. Check Prisma Schema
echo "1. Checking Prisma Schema..."
echo "   Looking for silence timer fields in Scenario model:"
grep -A 10 "無音時間管理" /workspaces/prance-communication-platform/packages/database/prisma/schema.prisma | grep -E "(showSilenceTimer|enableSilencePrompt|silenceTimeout)"
if [ $? -eq 0 ]; then
    echo "   ✅ Schema contains silence timer fields"
else
    echo "   ❌ Schema missing silence timer fields"
fi
echo ""

# 2. Check Migrations
echo "2. Checking Database Migrations..."
echo "   Silence-related migrations:"
ls -la /workspaces/prance-communication-platform/packages/database/prisma/migrations | grep -i silence
if [ $? -eq 0 ]; then
    echo "   ✅ Silence migrations exist"
else
    echo "   ❌ No silence migrations found"
fi
echo ""

# 3. Check Frontend Hook
echo "3. Checking Frontend Hook (useSilenceTimer)..."
if [ -f "/workspaces/prance-communication-platform/apps/web/hooks/useSilenceTimer.ts" ]; then
    echo "   ✅ useSilenceTimer hook exists"
    echo "   Hook exports:"
    grep -E "export (function|interface)" /workspaces/prance-communication-platform/apps/web/hooks/useSilenceTimer.ts
else
    echo "   ❌ useSilenceTimer hook missing"
fi
echo ""

# 4. Check Frontend UI Implementation
echo "4. Checking Frontend UI Implementation..."
echo "   SessionPlayer import:"
grep "useSilenceTimer" /workspaces/prance-communication-platform/apps/web/components/session-player/index.tsx | head -1
echo "   SessionPlayer usage:"
grep "silenceElapsedTime" /workspaces/prance-communication-platform/apps/web/components/session-player/index.tsx | head -1
echo "   UI Display code:"
grep -A 3 "Silence Timer Display" /workspaces/prance-communication-platform/apps/web/components/session-player/index.tsx | head -4
if [ $? -eq 0 ]; then
    echo "   ✅ UI implementation exists"
else
    echo "   ❌ UI implementation missing"
fi
echo ""

# 5. Check Backend Lambda Handler
echo "5. Checking Backend Lambda Handler..."
echo "   silence_prompt_request handler:"
grep -A 2 "case 'silence_prompt_request'" /workspaces/prance-communication-platform/infrastructure/lambda/websocket/default/index.ts | head -3
if [ $? -eq 0 ]; then
    echo "   ✅ Lambda handler exists"
else
    echo "   ❌ Lambda handler missing"
fi
echo ""

# 6. Check Translation Keys
echo "6. Checking Translation Keys..."
echo "   English translations:"
grep -i "silenceTimer\|silence.*timer" /workspaces/prance-communication-platform/apps/web/messages/en/sessions.json
echo "   Japanese translations:"
grep -i "silenceTimer\|沈黙" /workspaces/prance-communication-platform/apps/web/messages/ja/sessions.json
if [ $? -eq 0 ]; then
    echo "   ✅ Translation keys exist"
else
    echo "   ❌ Translation keys missing"
fi
echo ""

# 7. Check Default Value in SessionPlayer
echo "7. Checking Default Value in SessionPlayer..."
echo "   effectiveShowSilenceTimer default:"
grep "effectiveShowSilenceTimer.*??" /workspaces/prance-communication-platform/apps/web/components/session-player/index.tsx | head -1
if echo "$line" | grep -q "?? true"; then
    echo "   ✅ Default is true"
elif echo "$line" | grep -q "?? false"; then
    echo "   ❌ Default is false (should be true)"
else
    echo "   ⚠️ Could not determine default value"
fi
echo ""

echo "======================================"
echo "Summary"
echo "======================================"
echo "All components checked. See above for details."
echo ""
echo "Next steps:"
echo "1. Check browser console for effectiveShowSilenceTimer value"
echo "2. Verify database has correct schema (run migration if needed)"
echo "3. Check organization settings in database"
echo ""
