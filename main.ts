#!/usr/bin/env bun
// Main entry point for supabase-m2m CLI
import { Command } from 'commander';
import * as prompts from '@clack/prompts';
import { runSetup } from './commands/setup';
import { runOnboard } from './commands/onboard';

const program = new Command();

program
  .name('supabase-m2m')
  .description('Supabase Machine-to-Machine Authentication CLI')
  .version('1.0.0');

program
  .command('setup')
  .description(
    'Set up M2M authentication in your Supabase project (creates migrations + edge function)'
  )
  .action(async () => {
    try {
      await runSetup();
    } catch (error: any) {
      prompts.outro(`❌ An error occurred: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('onboard')
  .description('Register a new service and generate client credentials')
  .action(async () => {
    try {
      await runOnboard();
    } catch (error: any) {
      prompts.outro(`❌ An error occurred: ${error.message}`);
      process.exit(1);
    }
  });

// If no command provided, show interactive selection
if (process.argv.length === 2) {
  prompts.intro(`🤖 Supabase M2M Authentication CLI`);

  const selected = await prompts.select({
    message: 'What would you like to do?',
    options: [
      {
        value: 'setup',
        label: 'setup',
        hint: 'Set up M2M authentication in your Supabase project (creates migrations + edge function)',
      },
      {
        value: 'onboard',
        label: 'onboard',
        hint: 'Register a new service and generate client credentials',
      },
    ],
  });

  if (prompts.isCancel(selected)) {
    prompts.outro('Cancelled.');
    process.exit(0);
  }

  try {
    if (selected === 'setup') {
      await runSetup();
    } else if (selected === 'onboard') {
      await runOnboard();
    }
  } catch (error: any) {
    prompts.outro(`❌ An error occurred: ${error.message}`);
    process.exit(1);
  }
} else {
  program.parse();
}
