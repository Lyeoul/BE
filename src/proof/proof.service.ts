import { Injectable } from '@nestjs/common';
import { groth16 } from 'snarkjs';
import * as fs from 'fs';
import * as path from 'path';
import { buildPoseidon } from 'circomlibjs';

@Injectable()
export class ProofService {
  private poseidon: any;
  constructor() {
    buildPoseidon().then((poseidon) => {
      this.poseidon = poseidon;
    });
  }

  async hashWordWithCircuitLogic(word: string): Promise<bigint> {
    // 1) ASCII 20
    const asciiArr = this.toAsciiArray20(word);

    // 2) accum = 0, for i=0..19 => accum = accum*1000 + ascii[i]
    let accum = 0n;
    for (const code of asciiArr) {
      accum = accum * 1000n + BigInt(code);
    }

    // 3) poseidon([accum, 0])
    if (!this.poseidon) {
      const p = await buildPoseidon();
      this.poseidon = p;
    }
    const hashVal = this.poseidon([accum, 0n]);
    const F = this.poseidon.F;
    const finalHash = F.toObject(hashVal);

    return finalHash; 
  }

  /**
   * (2) ZK Proof 생성:
   *    word => fullProve({word, storedHash}, WordCheck.wasm, WordCheck.zkey)
   */
  async generateProof(word: string, storedHash: string): Promise<{
    proof: any,
    publicSignals: string[]
  }> {
    try {
      // wasm, zkey 파일 경로
      const wasmPath = path.join(__dirname, '..', '..', 'zk', 'WordCheck_js',  'WordCheck.wasm');
      const zkeyPath = path.join(__dirname, '..', '..', 'zk', 'WordCheck.zkey');

      const wasmData = fs.readFileSync(wasmPath);
      const zkeyData = fs.readFileSync(zkeyPath);

      // user가 입력한 word -> ascii[20]
      const asciiArr = this.toAsciiArray20(word);

      const circuitInput = {
        word: asciiArr,
        storedHash: storedHash
      };

      // snarkjs fullProve
      const { proof, publicSignals } = await groth16.fullProve(
        circuitInput,
        new Uint8Array(wasmData),
        new Uint8Array(zkeyData)
      );

      return { proof, publicSignals };
    } catch (error) {
      console.error('Error generating proof:', error);
      throw new Error('Proof generation failed');
    }
  }

  /**
   * (3) Proof 검증
   */
  async verifyProof(proof: any, publicSignals: string[]): Promise<boolean> {
    try {
      // verification key
      const vKeyPath = path.join(__dirname, '..', '..', 'zk', 'verification_key.json');
      const vKeyJson = fs.readFileSync(vKeyPath, 'utf-8');
      const vKey = JSON.parse(vKeyJson);

      // verify
      const res = await groth16.verify(vKey, publicSignals, proof);
      return res; 
    } catch (error) {
      console.error('Error verifying proof:', error);
      throw new Error('Proof verification failed');
    }
  }

  private toAsciiArray20(str: string): number[] {
    const arr = new Array(20).fill(0);
    for (let i=0; i<str.length && i<20; i++) {
      arr[i] = str.charCodeAt(i);
    }
    return arr;
  }
}
