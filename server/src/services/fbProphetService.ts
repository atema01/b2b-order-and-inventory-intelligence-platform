import { spawn } from 'child_process';
import path from 'path';

export type ProphetFrequency = 'D' | 'W-MON' | 'MS';

interface ProphetHistoryPoint {
  ds: string;
  y: number;
}

interface ProphetRunInput {
  history: ProphetHistoryPoint[];
  periods: number;
  frequency: ProphetFrequency;
}

interface ProphetRunResult {
  forecast: number[];
}

type PythonCommandAttempt = {
  command: string;
  args: string[];
};

const getPythonCommandAttempts = (): PythonCommandAttempt[] => {
  const configuredPath = process.env.PROPHET_PYTHON_PATH?.trim();
  if (configuredPath) {
    return [{ command: configuredPath, args: [] }];
  }

  return [
    { command: 'python', args: [] },
    { command: 'py', args: ['-3'] },
    { command: 'python3', args: [] }
  ];
};

const getProphetScriptPath = () => path.resolve(__dirname, '../../python/fb_prophet/prophet_forecast.py');

export const runFbProphetForecast = async (input: ProphetRunInput): Promise<ProphetRunResult> => {
  const scriptPath = getProphetScriptPath();
  const attempts = getPythonCommandAttempts();
  let lastError: Error | null = null;

  for (const attempt of attempts) {
    try {
      return await new Promise((resolve, reject) => {
        const child = spawn(attempt.command, [...attempt.args, scriptPath], {
          cwd: path.resolve(__dirname, '../../'),
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => {
          stdout += chunk.toString();
        });

        child.stderr.on('data', (chunk) => {
          stderr += chunk.toString();
        });

        child.on('error', (error) => {
          reject(new Error(`Unable to start Python process with "${attempt.command}": ${error.message}`));
        });

        child.on('close', (code) => {
          let parsed: any = null;
          try {
            parsed = stdout.trim() ? JSON.parse(stdout) : null;
          } catch {
            parsed = null;
          }

          if (code === 0 && parsed?.ok && Array.isArray(parsed.forecast)) {
            resolve({ forecast: parsed.forecast.map((value: any) => Number(value) || 0) });
            return;
          }

          const details = [
            parsed?.error ? String(parsed.error) : '',
            stderr.trim()
          ].filter(Boolean).join(' | ');

          reject(new Error(details || `FB Prophet process exited with code ${code ?? 'unknown'} using "${attempt.command}"`));
        });

        child.stdin.write(JSON.stringify(input));
        child.stdin.end();
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error('FB Prophet could not be started because no Python command was available.');
};
