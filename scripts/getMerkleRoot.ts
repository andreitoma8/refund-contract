import MerkleTree from "merkletreejs";
import keccak256 from "keccak256";
import { utils } from "ethers";

function main() {

    function generateLeaf(address: string, value: string): Buffer {
        return Buffer.from(utils.solidityKeccak256(["address", "uint256"], [address, value]).slice(2), "hex");
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

    const investors = {
        "0xF525E7409441743Dc77B5BaacF4755f4cc33400b": "1.25",
        "0x54859974A781e80a8D7353F4291B39b4988F8036": "0.115",
        "0x18BdaeF860d0153276cFD211E99A2F3028eA2795": "0.7",
        "0xfeD70Da796916f989bCbc5F217E4d4cA405190d4": "0.12",
        "0x0dD01F57994c11e3f9fFc16E555F95e9a7d62046": "0.15",
        "0xeFF9736086d11653Dbdfb34b6F54C7AfdF64A51f": "0.5",
        "0x2F76f1A2D21C87275bD8A3bbD3A6dC534f7d0770": "0.7",
        "0x49b38241Caa1c3E47ea686bC345ec59fcF302c2a": "0.225",
        "0x63Eba6AB81a65F065ddB4905e3A50313774C4FeD": "0.1",
        "0x626f68511be197546481354A5F5992E3906Ab639": "0.1",

    }

    const merkleTree = getMerkle(18, investors);
    const merkleRoot = merkleTree.getHexRoot();
    console.log(merkleRoot);

}
main()