// Setup command: Initial project setup (migrations + edge function)
import * as prompts from '@clack/prompts';
import * as path from 'path';
import { runSupabaseCommand } from '../utils';

const M2M_FUNCTION_NAME = 'm2m-token';

export async function runSetup() {
  prompts.intro(`🔧 Setting up M2M authentication in your Supabase project`);

  // Verify we're in Supabase project root
  const supabaseDir = path.join(process.cwd(), 'supabase');
  const configFile = path.join(supabaseDir, 'config.toml');
  try {
    const file = Bun.file(configFile);
    const exists = await file.exists();
    if (!exists) {
      prompts.outro(
        '❌ Error: Not in a Supabase project root. Please navigate to your Supabase project directory.'
      );
      return;
    }
  } catch {
    prompts.outro(
      '❌ Error: Not in a Supabase project root. Please navigate to your Supabase project directory.'
    );
    return;
  }

  // Create migration using Supabase CLI
  prompts.log.step('Creating migration...');
  try {
    await runSupabaseCommand(['migration', 'new', 'm2m_init']);
  } catch (error: any) {
    prompts.outro(`❌ Failed to create migration: ${error.message}`);
    return;
  }

  // Get the latest migration file (just created by Supabase CLI)
  const migrationDir = path.join(process.cwd(), 'supabase', 'migrations');
  const migrationFiles = await Array.fromAsync(
    new Bun.Glob('*.sql').scan({ cwd: migrationDir })
  );
  const latestMigration = migrationFiles.sort().reverse()[0] as string;
  const targetMigrationFile = path.join(migrationDir, latestMigration);

  // Get template file paths
  const scriptDir = path.dirname(import.meta.path);
  const templateDir = path.join(scriptDir, '..', 'template');
  const migrationTemplate = path.join(templateDir, 'migration.sql');
  const edgeFunctionTemplate = path.join(templateDir, 'edge-function.ts');

  // Write migration template content
  const migrationContent = await Bun.file(migrationTemplate).text();
  await Bun.write(targetMigrationFile, migrationContent);
  prompts.log.info(`Migration created: ${path.basename(targetMigrationFile)}`);

  // Apply migration
  prompts.log.step('Applying migration...');
  try {
    await runSupabaseCommand(['migration', 'up']);
  } catch (error: any) {
    prompts.outro(`❌ Failed to apply migration: ${error.message}`);
    return;
  }

  // Generate JWT signing key pair
  prompts.log.step('Generating JWT signing key...');
  const signingKeyPath = path.join(
    process.cwd(),
    'supabase',
    'signing_key.json'
  );
  try {
    const signingKeyFile = Bun.file(signingKeyPath);
    const keyExists = await signingKeyFile.exists();

    if (keyExists) {
      prompts.log.info('Signing key already exists, skipping generation.');
    } else {
      // Generate EC key pair (ES256) - compatible with Supabase JWKS
      const keyPair = await crypto.subtle.generateKey(
        {
          name: 'ECDSA',
          namedCurve: 'P-256',
        },
        true, // extractable
        ['sign', 'verify']
      );

      // Export private key as JWK
      const privateKeyJwk = await crypto.subtle.exportKey(
        'jwk',
        keyPair.privateKey
      );
      const publicKeyJwk = await crypto.subtle.exportKey(
        'jwk',
        keyPair.publicKey
      );

      // Generate a unique kid (key ID)
      const kid = crypto.randomUUID();

      // Create signing key in Supabase format (array with private key)
      const signingKey = [
        {
          kty: 'EC',
          kid: kid,
          use: 'sig',
          key_ops: ['sign', 'verify'],
          alg: 'ES256',
          ext: true,
          d: privateKeyJwk.d, // private key component
          crv: 'P-256',
          x: publicKeyJwk.x,
          y: publicKeyJwk.y,
        },
      ];

      await Bun.write(signingKeyPath, JSON.stringify(signingKey, null, 2));
      prompts.log.info(
        `Signing key generated: ${path.basename(signingKeyPath)}`
      );
    }
  } catch (error: any) {
    prompts.log.warn(`Could not generate signing key: ${error.message}`);
    prompts.note(
      'You may need to generate a signing key manually. See Supabase docs for JWT signing keys.',
      'INFO'
    );
  }

  // Ensure config.toml has signing_keys_path
  const configTomlPath = path.join(process.cwd(), 'supabase', 'config.toml');
  try {
    let configContent = await Bun.file(configTomlPath).text();
    if (!configContent.includes('signing_keys_path')) {
      // Add signing_keys_path to [auth] section
      const authSection = /(\[auth\][\s\S]*?)(?=\n\[|\n*$)/;
      if (authSection.test(configContent)) {
        configContent = configContent.replace(
          authSection,
          `$1\nsigning_keys_path = "./signing_key.json"`
        );
        await Bun.write(configTomlPath, configContent);
        prompts.log.info('Added signing_keys_path to config.toml');
      }
    }
  } catch (error: any) {
    prompts.log.warn(`Could not update config.toml: ${error.message}`);
  }

  // Bootstrap edge function using Supabase CLI
  prompts.log.step('Creating edge function...');
  try {
    await runSupabaseCommand(['functions', 'new', M2M_FUNCTION_NAME]);
    prompts.log.info(`Edge function bootstrapped: ${M2M_FUNCTION_NAME}`);
  } catch (error: any) {
    prompts.outro(`❌ Failed to create edge function: ${error.message}`);
    return;
  }

  // Copy template code into the bootstrapped function
  const funcDir = path.join(
    process.cwd(),
    'supabase',
    'functions',
    M2M_FUNCTION_NAME
  );
  try {
    const edgeFunctionContent = await Bun.file(edgeFunctionTemplate).text();
    await Bun.write(path.join(funcDir, 'index.ts'), edgeFunctionContent);
    prompts.log.info(
      `Edge function code updated: ${M2M_FUNCTION_NAME}/index.ts`
    );
  } catch (error: any) {
    prompts.outro(`❌ Failed to write edge function code: ${error.message}`);
    return;
  }

  // Update config.toml to disable JWT verification for M2M function
  try {
    let configContent = await Bun.file(configTomlPath).text();

    // Check if function config already exists
    const functionConfigRegex = new RegExp(
      `\\[functions\\.${M2M_FUNCTION_NAME}\\]`,
      'g'
    );
    if (!functionConfigRegex.test(configContent)) {
      // Add function configuration after [edge_runtime] section
      // Look for the end of [edge_runtime] section (before next [section] or end of file)
      const edgeRuntimeSection = /(\[edge_runtime\][\s\S]*?)(?=\n\[|\n*$)/;
      if (edgeRuntimeSection.test(configContent)) {
        configContent = configContent.replace(
          edgeRuntimeSection,
          `$1\n\n# Disable JWT verification for M2M token endpoint (machine-to-machine authentication)\n[functions.${M2M_FUNCTION_NAME}]\nverify_jwt = false`
        );
      } else {
        // Fallback: append at the end
        configContent += `\n\n# Disable JWT verification for M2M token endpoint (machine-to-machine authentication)\n[functions.${M2M_FUNCTION_NAME}]\nverify_jwt = false\n`;
      }

      await Bun.write(configTomlPath, configContent);
      prompts.log.info(
        `Updated config.toml: Disabled JWT verification for ${M2M_FUNCTION_NAME}`
      );
    } else {
      prompts.log.info(
        `config.toml already has configuration for ${M2M_FUNCTION_NAME}`
      );
    }
  } catch (error: any) {
    prompts.log.warn(`Could not update config.toml: ${error.message}`);
    prompts.note(
      `Please manually add to supabase/config.toml:\n[functions.${M2M_FUNCTION_NAME}]\nverify_jwt = false`,
      'INFO'
    );
  }

  // Get values from supabase status
  prompts.log.step('Getting configuration from Supabase...');
  try {
    const statusProc = Bun.spawn(['supabase', 'status', '--output', 'env'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await statusProc.exited;
    if (statusProc.exitCode !== 0) {
      throw new Error('Failed to get Supabase status');
    }
    const statusOutput = await new Response(statusProc.stdout).text();

    const supabaseUrl =
      statusOutput
        .split('\n')
        .find((line) => line.startsWith('API_URL='))
        ?.split('=')[1]
        ?.replace(/^"|"$/g, '') || '';

    const secretKey =
      statusOutput
        .split('\n')
        .find((line) => line.startsWith('SECRET_KEY='))
        ?.split('=')[1]
        ?.replace(/^"|"$/g, '') || '';

    const jwtSecret =
      statusOutput
        .split('\n')
        .find((line) => line.startsWith('JWT_SECRET='))
        ?.split('=')[1]
        ?.replace(/^"|"$/g, '') || '';

    if (!supabaseUrl || !secretKey || !jwtSecret) {
      throw new Error(
        'Could not get SUPABASE_URL, SECRET_KEY, or JWT_SECRET from status'
      );
    }

    // Deploy edge function
    prompts.log.step('Deploying edge function...');
    try {
      await runSupabaseCommand([
        'functions',
        'deploy',
        M2M_FUNCTION_NAME,
        '--no-verify-jwt',
      ]);
    } catch (error: any) {
      prompts.outro(`❌ Failed to deploy edge function: ${error.message}`);
      return;
    }

    // Set secrets (only the ones actually used by the edge function)
    prompts.log.step('Setting edge function secrets...');
    try {
      await runSupabaseCommand([
        'secrets',
        'set',
        `SUPABASE_URL=${supabaseUrl}`,
      ]);
      await runSupabaseCommand([
        'secrets',
        'set',
        `SUPABASE_SECRET_KEY=${secretKey}`,
      ]);

      // Set JWT_PRIVATE_KEY from the generated signing key
      const signingKeyPath = path.join(
        process.cwd(),
        'supabase',
        'signing_key.json'
      );
      const signingKeyFile = Bun.file(signingKeyPath);
      if (await signingKeyFile.exists()) {
        const signingKeyContent = await signingKeyFile.json();
        if (Array.isArray(signingKeyContent) && signingKeyContent.length > 0) {
          const privateKey = signingKeyContent[0];
          // Set the private key as a secret (JWK format as JSON string)
          await runSupabaseCommand([
            'secrets',
            'set',
            `JWT_PRIVATE_KEY=${JSON.stringify(privateKey)}`,
          ]);
          prompts.log.info('Set JWT_PRIVATE_KEY secret');
        }
      } else {
        prompts.log.warn(
          'Signing key not found, skipping JWT_PRIVATE_KEY secret'
        );
      }
    } catch (error: any) {
      prompts.outro(`❌ Failed to set secrets: ${error.message}`);
      return;
    }

    prompts.note(
      `\nNext steps:\n` + `1. Register a service: supabase-m2m onboard`,
      'INFO'
    );
    prompts.outro(
      '✅ Setup complete! Migration applied and edge function deployed.'
    );
  } catch (error: any) {
    prompts.outro(`❌ Failed to get Supabase configuration: ${error.message}`);
    return;
  }
}
