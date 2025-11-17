// Onboard command: Register a new service/client
import * as prompts from '@clack/prompts';
import { createClient } from '@supabase/supabase-js';

/**
 * Generates a cryptographically secure random string for use as a credential.
 * @param bytes - The number of random bytes to generate (entropy).
 * @returns The URL-safe Base64 encoded string.
 */
function generateSecureCredential(bytes: number): string {
  const rawBytes = crypto.getRandomValues(new Uint8Array(bytes));
  // Convert to base64url (URL-safe Base64)
  return Buffer.from(rawBytes).toString('base64url');
}

export async function runOnboard() {
  prompts.intro(`📝 Registering a new service for M2M authentication`);

  // Get Supabase URL and secret key
  const supabaseUrl = await prompts.text({
    message: 'Supabase URL:',
    initialValue: 'http://localhost:54321',
    validate: (value) =>
      value && value.length > 0 ? undefined : 'Supabase URL is required.',
  });
  if (prompts.isCancel(supabaseUrl)) {
    prompts.outro('Onboard cancelled.');
    return;
  }

  prompts.note(
    '💡 Tip: Get your SECRET_KEY by running: supabase status --output env | grep SECRET_KEY',
    'INFO'
  );
  const secretKey = await prompts.password({
    message: 'Secret Key (sb_secret_...):',
    validate: (value) =>
      value && value.length > 0 ? undefined : 'Secret key is required.',
  });
  if (prompts.isCancel(secretKey)) {
    prompts.outro('Onboard cancelled.');
    return;
  }

  const supabase = createClient(supabaseUrl as string, secretKey as string);

  // Verify machine_secrets table exists
  const { error: checkError } = await supabase
    .from('machine_secrets')
    .select('client_id')
    .limit(1);

  if (checkError) {
    prompts.outro(
      `❌ Error: machine_secrets table not found. Please run 'supabase-m2m setup' first.\n` +
        `Error: ${checkError.message}`
    );
    return;
  }

  // Gather client information
  prompts.log.step('Enter service details...');

  const scopesInput = await prompts.text({
    message:
      'Enter required scopes (comma-separated, e.g., api:read,jobs:write):',
    initialValue: 'default:read',
  });
  if (prompts.isCancel(scopesInput)) {
    prompts.outro('Registration cancelled.');
    return;
  }
  const scopes = (scopesInput as string)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const s = prompts.spinner();
  s.start('Generating and securely hashing credentials...');

  // Generate secure random credentials
  // Client ID: 16 bytes (128 bits) -> ~22 character Base64 string
  const CLIENT_ID_BYTES = 16;
  const clientId = generateSecureCredential(CLIENT_ID_BYTES);

  // Client Secret: 32 bytes (256 bits) -> ~43 character Base64 string
  const CLIENT_SECRET_BYTES = 32;
  const clientSecret = generateSecureCredential(CLIENT_SECRET_BYTES);

  // **CRITICAL:** Use Bcrypt for Golang compatibility!
  const clientSecretHash = await Bun.password.hash(clientSecret, {
    algorithm: 'bcrypt',
    cost: 10, // Default cost
  });

  // Insert or update in Database
  const { error: dbError } = await supabase.from('machine_secrets').upsert(
    {
      client_id: clientId as string,
      client_secret_hash: clientSecretHash,
      scopes: scopes,
      is_active: true,
    },
    {
      onConflict: 'client_id',
    }
  );

  if (dbError) {
    s.stop('Database operation failed.');
    prompts.outro(`❌ Registration Failed: ${dbError.message}`);
    return;
  }

  s.stop(`Client '${clientId}' registered successfully!`);

  // Display credentials prominently
  console.log('\n');
  prompts.log.step(
    '═══════════════════════════════════════════════════════════'
  );
  prompts.log.step('  🔐 SECURE CLIENT CREDENTIALS - SAVE THESE NOW!');
  prompts.log.step(
    '═══════════════════════════════════════════════════════════'
  );
  console.log('\n');
  prompts.log.info(`CLIENT_ID:\n  ${clientId}\n`);
  prompts.log.info(`CLIENT_SECRET:\n  ${clientSecret}\n`);
  prompts.log.step(
    '═══════════════════════════════════════════════════════════'
  );
  prompts.note(
    `Both credentials are randomly generated and cryptographically secure.\n` +
      `⚠️  Store them securely in your service's environment variables.\n` +
      `⚠️  You will NOT be able to retrieve the CLIENT_SECRET again.`,
    'IMPORTANT'
  );

  // Generate .env file
  const envPath = '.env';
  const envExists = await Bun.file(envPath).exists();

  if (envExists) {
    const overwrite = await prompts.confirm({
      message: `.env file already exists. Overwrite it?`,
      initialValue: false,
    });
    if (prompts.isCancel(overwrite)) {
      prompts.outro('Onboard cancelled.');
      return;
    }
    if (!overwrite) {
      prompts.log.warn('Skipping .env file generation.');
    } else {
      await generateEnvFile(
        envPath,
        clientId,
        clientSecret,
        supabaseUrl as string
      );
      prompts.log.success(`✅ Generated ${envPath}`);
    }
  } else {
    await generateEnvFile(
      envPath,
      clientId,
      clientSecret,
      supabaseUrl as string
    );
    prompts.log.success(`✅ Generated ${envPath}`);
  }

  prompts.outro(
    '✅ Service registered! Your service can now use these credentials.'
  );
}

/**
 * Generates a .env file with the client credentials and configuration.
 */
async function generateEnvFile(
  path: string,
  clientId: string,
  clientSecret: string,
  supabaseUrl: string
): Promise<void> {
  const envContent = `# Client Credentials (generated by supabase-m2m onboard)
CLIENT_ID=${clientId}
CLIENT_SECRET=${clientSecret}

# Supabase Configuration
SUPABASE_URL=${supabaseUrl}

# Optional: API Configuration (uncomment and set as needed)
# API_URL=http://localhost:3000
# PORT=4000
`;

  await Bun.write(path, envContent);
}
