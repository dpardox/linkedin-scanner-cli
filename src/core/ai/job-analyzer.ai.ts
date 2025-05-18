import 'dotenv/config';
import { OpenAI } from 'openai';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import clipboard from 'clipboardy';
import { Logger} from '@interfaces/logger.interface';


export class JobAnalyzerAI {

  // private openai: OpenAI;

  constructor(
    private readonly logger: Logger,
  ) {
    this.init();
  }

  private init(): void {
    // this.openai = new OpenAI({
    //   apiKey: process.env.OPENAI_API_KEY,
    // });
  }

  private async getInstructions(): Promise<string> {
    try {
      this.logger.info('📜 Loading instructions...');
      return await readFile(resolve(__dirname, './instructions.md'), 'utf-8');
    } catch (error) {
      this.logger.error('⚠️ Error loading instructions: %s', error);
      process.exit(1);
    }
  }

  private async copyToClipboard(text: string): Promise<void> { // TODO (dpardo): move to a plugin
    try {
      if (process.env.COPY_TO_CLIPBOARD !== 'true') return;

      // Log.info('📋 Copying text to clipboard...');
      await clipboard.write(text);
      this.logger.success('✅ Text copied to clipboard!');
      // Log.info('🔗 GPT Link: %s', 'https://chatgpt.com/g/g-68102c16950c81919f88bc6f4b244f0d-job-fitness');
    } catch (error) {
      this.logger.error('⚠️ Error copying text to clipboard: %s', error);
    }
  }

  public async chat(input: string) {
    await this.copyToClipboard(input);
    // try {
    //   const instructions = await this.getInstructions();

    //   Log.info('🤖 Sending request to OpenAI...');
    //   return await this.openai.responses.create({
    //     model: 'gpt-4o',
    //     instructions,
    //     input,
    //   });
    // } catch ({ error }) {
    //   Log.error('⚠️ %s', error.message);
    //   await this.copyToClipboard(input);
    // }
  }

}

// TODO (dpardo): create a test for this class
