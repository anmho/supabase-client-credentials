// Shared utilities for sb-m2m CLI commands
import { createClient } from '@supabase/supabase-js';
import * as prompts from '@clack/prompts';

const SUPABASE_URL = Bun.env.SUPABASE_URL || 'http://localhost:54321';
const SERVICE_ROLE_KEY = Bun.env.SERVICE_ROLE_KEY;

export function getSupabaseClient() {
    if (!SERVICE_ROLE_KEY) {
        throw new Error('SERVICE_ROLE_KEY must be set in your environment variables.');
    }
    return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

export async function runSupabaseCommand(command: string[]): Promise<void> {
    const s = prompts.spinner();
    s.start(`Running 'supabase ${command.join(' ')}'...`);
    try {
        const proc = Bun.spawn(['supabase', ...command], {
            stdout: 'pipe',
            stderr: 'pipe',
        });
        await proc.exited;
        if (proc.exitCode !== 0) {
            const stderr = await new Response(proc.stderr).text();
            throw new Error(`Supabase command failed. Output: ${stderr}`);
        }
        s.stop(`'supabase ${command.join(' ')}' completed successfully.`);
    } catch (e: any) {
        s.stop(`Command failed.`);
        throw e;
    }
}

// Help is now handled by Commander.js
// This file is kept for backward compatibility if needed

