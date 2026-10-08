import { useCallback } from "react";
import { BrowserProvider, Contract } from "ethers";
import { CONTRACT_ADDRESS } from "../contracts/contractAddress.js";
import ABI from "../contracts/DairyChainABI.json";

function getContract() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed.");
  }

  const provider = new BrowserProvider(window.ethereum);

  return provider.getSigner().then((signer) => {
    return new Contract(CONTRACT_ADDRESS, ABI, signer);
  });
}

export function useContract() {

  // ---------------------------------------------------------
  // GET BATCH
  // ---------------------------------------------------------
  const getBatch = useCallback(async (batchId) => {
    const contract = await getContract();

    const result = await contract.getBatch(batchId);

    return {
      batchId: result[0],
      containerId: result[1],
      originCooperative: result[2],
      volumeLiters: Number(result[3]),
      createdAt: Number(result[4]),
      exists: result[5],
    };
  }, []);

  // ---------------------------------------------------------
  // CHECK WHETHER BATCH EXISTS
  // ---------------------------------------------------------
  const batchExists = useCallback(async (batchId) => {
    const contract = await getContract();

    return await contract.batchExists(batchId);
  }, []);

  // ---------------------------------------------------------
  // CREATE BATCH
  // ---------------------------------------------------------
  const createBatch = useCallback(async (input) => {
    const contract = await getContract();

    const batchId = input.batchId;
    const containerId = input.containerId;
    const originCooperative =
      input.originCooperative || input.cooperative || "";
    const volumeLiters = Number(input.volumeLiters || 0);

    const tx = await contract.createBatch(
      batchId,
      containerId,
      originCooperative,
      volumeLiters
    );

    const receipt = await tx.wait();

    return {
      txHash: receipt.hash,
    };
  }, []);

  // ---------------------------------------------------------
  // COMMIT TELEMETRY
  // ---------------------------------------------------------
  const commitTelemetry = useCallback(
    async (batchId, merkleRoot, readingCount) => {
      const contract = await getContract();

      const tx = await contract.commitTelemetry(
        batchId,
        merkleRoot,
        Number(readingCount)
      );

      const receipt = await tx.wait();

      return {
        txHash: receipt.hash,
      };
    },
    []
  );

  // ---------------------------------------------------------
  // RECORD CRITICAL TEMPERATURE VIOLATION
  // ---------------------------------------------------------
  const recordViolation = useCallback(
    async (batchId, temperature, reason) => {
      const contract = await getContract();

      const tx = await contract.recordViolation(
        batchId,
        Math.round(Number(temperature)),
        reason
      );

      const receipt = await tx.wait();

      return {
        txHash: receipt.hash,
      };
    },
    []
  );

  // ---------------------------------------------------------
  // GET TELEMETRY COMMITMENTS
  // ---------------------------------------------------------
  const getTelemetryCommitments = useCallback(
    async (batchId) => {
      const contract = await getContract();

      const count = Number(
        await contract.getCommitmentCount(batchId)
      );

      const commitments = [];

      for (let i = 0; i < count; i++) {
        const result = await contract.getTelemetryCommitment(
          batchId,
          i
        );

        commitments.push({
          merkleRoot: result[0],
          timestamp: Number(result[1]),
          readingCount: Number(result[2]),
        });
      }

      return commitments;
    },
    []
  );

  // ---------------------------------------------------------
  // GET VIOLATIONS
  // ---------------------------------------------------------
  const getViolations = useCallback(async () => {
    const contract = await getContract();

    const count = Number(
      await contract.getViolationCount()
    );

    const violations = [];

    for (let i = 0; i < count; i++) {
      const result = await contract.getViolation(i);

      violations.push({
        batchId: result[0],
        containerId: result[1],
        temperature: Number(result[2]),
        timestamp: Number(result[3]),
        reason: result[4],
      });
    }

    return violations;
  }, []);

  // ---------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------
  return {
    getBatch,
    batchExists,
    createBatch,
    commitTelemetry,
    recordViolation,
    getTelemetryCommitments,
    getViolations,
  };
}

export default useContract;