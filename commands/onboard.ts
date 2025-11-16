// Onboard command: Register a new service/client
import * as prompts from '@clack/prompts';
import { getSupabaseClient } from '../utils';

export async function runOnboard() {
    prompts.intro(`📝 Registering a new service for M2M authentication`);

    const supabase = getSupabaseClient();

    // Verify machine_secrets table exists
    const { error: checkError } = await supabase
        .from('machine_secrets')
        .select('client_id')
        .limit(1);

    if (checkError) {
        prompts.outro(
            `❌ Error: machine_secrets table not found. Please run 'sb-m2m setup' first.\n` +
            `Error: ${checkError.message}`
        );
        return;
    }

    // Gather client information
    prompts.log.step('Enter service details...');

    const clientId = await prompts.text({
        message: 'Enter the unique CLIENT_ID (e.g., notification-service):',
        validate: (value) => value && value.length > 0 ? undefined : 'Client ID is required.',
    });
    if (prompts.isCancel(clientId)) {
        prompts.outro("Registration cancelled.");
        return;
    }

    // Check if client_id already exists
    const { data: existing } = await supabase
        .from('machine_secrets')
        .select('client_id')
        .eq('client_id', clientId as string)
        .single();

    if (existing) {
        const overwrite = await prompts.confirm({
            message: `Client ID '${clientId}' already exists. Overwrite?`,
            initialValue: false,
        });
        if (prompts.isCancel(overwrite) || !overwrite) {
            prompts.outro("Registration cancelled.");
            return;
        }
    }

    const scopesInput = await prompts.text({
        message: 'Enter required scopes (comma-separated, e.g., api:read,jobs:write):',
        initialValue: 'default:read',
    });
    if (prompts.isCancel(scopesInput)) {
        prompts.outro("Registration cancelled.");
        return;
    }
    const scopes = (scopesInput as string).split(',').map(s => s.trim()).filter(s => s.length > 0);

    const s = prompts.spinner();
    s.start('Generating and securely hashing credentials...');

    const clientSecret = crypto.randomUUID() + crypto.randomUUID();

    // **CRITICAL:** Use Bcrypt for Golang compatibility!
    const clientSecretHash = await Bun.password.hash(clientSecret, {
        algorithm: "bcrypt",
        cost: 10 // Default cost
    });

    // Insert or update in Database
    const { error: dbError } = await supabase
        .from('machine_secrets')
        .upsert({
            client_id: clientId as string,
            client_secret_hash: clientSecretHash,
            scopes: scopes,
            is_active: true,
        }, {
            onConflict: 'client_id'
        });

    if (dbError) {
        s.stop('Database operation failed.');
        prompts.outro(`❌ Registration Failed: ${dbError.message}`);
        return;
    }

    s.stop(`Client '${clientId}' registered successfully!`);

    prompts.note(
        `\n-- SECURE CLIENT CREDENTIALS --\n` +
        `CLIENT_ID:      ${clientId}\n` +
        `CLIENT_SECRET:  ${clientSecret}\n\n` +
        `Store the CLIENT_SECRET securely in your service's environment variables.\n` +
        `You will not be able to retrieve it again.`,
        'IMPORTANT'
    );
    prompts.outro("✅ Service registered! Your Go service can now use these credentials.");
}

