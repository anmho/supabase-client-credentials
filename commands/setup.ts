// Setup command: Initial project setup (migrations + edge function)
import * as prompts from '@clack/prompts';
import * as path from 'path';
import { runSupabaseCommand } from '../utils';

const M2M_FUNCTION_NAME = 'm2m-token';
const M2M_MIGRATION_FILE = 'm2m_init.sql';

export async function runSetup() {
    prompts.intro(`🔧 Setting up M2M authentication in your Supabase project`);

    // Verify we're in Supabase project root
    const supabaseDir = path.join(process.cwd(), 'supabase');
    const configFile = path.join(supabaseDir, 'config.toml');
    try {
        const file = Bun.file(configFile);
        const exists = await file.exists();
        if (!exists) {
            prompts.outro('❌ Error: Not in a Supabase project root. Please navigate to your Supabase project directory.');
            return;
        }
    } catch {
        prompts.outro('❌ Error: Not in a Supabase project root. Please navigate to your Supabase project directory.');
        return;
    }

    // Gather configuration for edge function
    prompts.log.step('Configuring edge function...');
    
    const corsOrigin = await prompts.text({
        message: 'CORS origin (allowed origin for requests, use * for all):',
        initialValue: '*',
        validate: (value) => value && value.length > 0 ? undefined : 'CORS origin is required.',
    });
    if (prompts.isCancel(corsOrigin)) {
        prompts.outro('Setup cancelled.');
        return;
    }

    const tokenExpiryMinutes = await prompts.text({
        message: 'Token expiration time (minutes):',
        initialValue: '60',
        validate: (value) => {
            const num = parseInt(value || '0');
            return num > 0 ? undefined : 'Token expiry must be a positive number.';
        },
    });
    if (prompts.isCancel(tokenExpiryMinutes)) {
        prompts.outro('Setup cancelled.');
        return;
    }

    const tokenExpirySeconds = parseInt(tokenExpiryMinutes as string) * 60;

    // Copy Migration File
    const migrationDir = path.join(process.cwd(), 'supabase', 'migrations');
    const funcDir = path.join(process.cwd(), 'supabase', 'functions', M2M_FUNCTION_NAME);
    const timestamp = new Date().toISOString().replace(/\D/g, '').substring(0, 14);
    const targetMigrationFile = path.join(migrationDir, `${timestamp}_${M2M_MIGRATION_FILE}`);

    // Get template file paths (relative to this script)
    const scriptDir = path.dirname(import.meta.path);
    const templateDir = path.join(scriptDir, '..', 'template');
    const migrationTemplate = path.join(templateDir, 'migration.sql');
    const edgeFunctionTemplate = path.join(templateDir, 'edge-function.ts.template');

    // Copy and process template files
    try {
        const migrationContent = await Bun.file(migrationTemplate).text();
        await Bun.write(targetMigrationFile, migrationContent);

        // Read template and replace placeholders
        let edgeFunctionContent = await Bun.file(edgeFunctionTemplate).text();
        edgeFunctionContent = edgeFunctionContent
            .replace(/\{\{CORS_ORIGIN\}\}/g, corsOrigin as string)
            .replace(/\{\{TOKEN_EXPIRY_SECONDS\}\}/g, tokenExpirySeconds.toString())
            .replace(/\{\{TOKEN_EXPIRY_MINUTES\}\}/g, tokenExpiryMinutes as string);

        await Bun.write(path.join(funcDir, 'index.ts'), edgeFunctionContent);

        prompts.log.info(`Files generated. Migration: ${path.basename(targetMigrationFile)}`);
    } catch (error: any) {
        prompts.outro(`❌ Failed to process template files: ${error.message}`);
        return;
    }

    // Deploy Function
    try {
        prompts.log.info('Note: If Supabase is running, you may need to run "supabase db reset" to apply the migration.');
        await runSupabaseCommand(['functions', 'deploy', M2M_FUNCTION_NAME, '--no-verify-jwt']);
    } catch (error: any) {
        prompts.outro(`❌ Setup Failed. Ensure 'supabase start' is running. Error: ${error.message}`);
        return;
    }

    prompts.note(
        `\nNext steps:\n` +
        `1. Run 'supabase db reset' to apply the migration (if Supabase is already running)\n` +
        `2. Run 'sb-m2m onboard' to register your first service`,
        'INFO'
    );
    prompts.outro('✅ Setup complete! Your Supabase project is ready for M2M authentication.');
}

