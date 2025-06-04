import * as bcrypt from 'bcrypt'

const SALT_ROUNDS = 12;
export class HashService {
  
    static hash(input: string): Promise<string> {
      return bcrypt.hash(input, SALT_ROUNDS);
    }
  
    static compare(input: string, hash: string): Promise<boolean> {
      return bcrypt.compare(input, hash);
    }
  }