import MerkleTree from "merkletreejs";
import keccak256 from "keccak256";
import { utils } from "ethers";

function generateLeaf(address: string, value: string): Buffer {
    return Buffer.from(utils.solidityKeccak256(["address", "uint256"], [address, value]).slice(2), "hex");
}

function getProof(merkle: MerkleTree, address: string, value: string, decimals: number): string[] {
    return merkle.getHexProof(generateLeaf(address, utils.parseUnits(value, decimals).toString()));
}

function getMerkle(decimals: number, investors: Record<string, string>): MerkleTree {
    return new MerkleTree(
        Object.entries(investors).map(([address, tokens]) =>
            generateLeaf(address, utils.parseUnits(tokens.toString(), decimals).toString())
        ),
        keccak256,
        { sortPairs: true }
    );
}

export default {
    generateLeaf,
    getMerkle,
    getProof,
};