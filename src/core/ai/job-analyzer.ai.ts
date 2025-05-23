import 'dotenv/config';
import { OpenAI } from 'openai';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import clipboard from 'clipboardy';
import { LoggerPort } from '@ports/logger.port';


export class JobAnalyzerAI {

  // private openai: OpenAI;

  constructor(
    private readonly logger: LoggerPort,
  ) {
    this.init();
  }

  private init(): void {
    // this.openai = new OpenAI({
    //   apiKey: process.env.OPENAI_API_KEY,
    // });
  }

  private async getInstructions(): Promise<string> {
    this.logger.info('📜 Loading instructions...');
    return await readFile(resolve(__dirname, './instructions.md'), 'utf-8');
  }

  private async copyToClipboard(text: string): Promise<void> { // TODO (dpardo): move to a plugin
    if (process.env.COPY_TO_CLIPBOARD !== 'true') return;
    await clipboard.write(text);
    this.logger.success('Text copied to clipboard!');
  }

  public async chat(input: string) {
    await this.copyToClipboard(input);

    // const instructions = await this.getInstructions();

    // this.logger.info('Sending request to OpenAI...');
    // return await this.openai.responses.create({
    //   model: 'gpt-4o',
    //   instructions,
    //   input,
    // });
  }

}

// TODO (dpardo): remove this feature and move cliboard to a adapter
