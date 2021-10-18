const { ApiPromise, Keyring, WsProvider } = require('@polkadot/api');
const { stringToU8a, u8aToHex, u8aToString } = require('@polkadot/util');
const beer = require('beer-names');

async function main() {
    const wsProvider = new WsProvider('ws://127.0.0.1:9945');
    const api = await ApiPromise.create({ provider: wsProvider });
    const keyring = new Keyring({ type: 'sr25519' });
    // Dev only
    const alice = keyring.addFromUri('//Alice', { name: 'Alice' });

    // Retrieve the last timestamp
    // const now = await api.query.timestamp.now();

    // Retrieve the account balance & nonce via the system module
    // const { nonce, data: balance } = await api.query.system.account(alice.address);
    // console.log(`${now}: balance of ${balance.free} and a nonce of ${nonce}`);

    const classId = 1;
    const className = "SubstraBeer";
    await createBeers(api, alice, classId, className);

    // In this example we're calling the unsubscribe() function that is being
    // returned by the api call function after 20s.
    // setTimeout(() => {
    //     unsub();
    //     console.log('Cleanup');
    // }, 120000);
}

async function createBeers(api, owner, classId, className) {
    // Create NFT class & set name attribute
    console.log(`Creating NFT class ${className} ...`);
    const unsub = await api.tx.utility.batchAll([
        api.tx.uniques.create(classId, owner.address),
        api.tx.uniques.setAttribute(classId, null, "name", className)
    ]).signAndSend(owner, async (result) => {
        if (result.status.isInBlock) {
            console.log(`Tx included at in block ${result.status.asInBlock}`);
        } else if (result.status.isFinalized) {
            console.log(`Created NFT class ${className} (${result.status.asFinalized})`);
            unsub();

            // Create 10 NFT instances w/ attributes
            let beers = [];
            for (let i = 1; i <= 10; i++) {
                let name = beer.random();
                const suffixPos = name.indexOf(' ', name.indexOf(' ') + 1);
                const type = name.substring(suffixPos + 1);
                name = name.substring(0, suffixPos);
                beers.push(api.tx.uniques.mint(classId, i, owner.address));
                beers.push(api.tx.uniques.setAttribute(classId, i, "name", name));
                beers.push(api.tx.uniques.setAttribute(classId, i, "type", type));
            };

            await api.tx.utility.batchAll(beers).signAndSend(owner, { nonce: -1 }, async (result) => {
                if (result.status.isFinalized) {
                    console.log(`Created 10 unique beers (${result.status.asFinalized})`);
                    console.log('-----------------------');

                    const uniqueBeers = await queryBeers(api, classId);
                    uniqueBeers.forEach((beer) => console.log(beer));
                    process.exit(0);
                }
            });
        }
    });
}

async function queryBeers(api, classId) {
    const beers = Array();
    const classDetails = (await api.query.uniques.class(classId)).unwrapOrDefault();
    for (let i = 1; i <= classDetails.instances; i++) {
        const [name, _dep1] = (await api.query.uniques.attribute(classId, i, "name")).unwrapOrDefault();
        const [type, _dep2] = (await api.query.uniques.attribute(classId, i, "type")).unwrapOrDefault();
        beers.push(`${u8aToString(name)} (${u8aToString(type)})`);
    }
    return beers;
}

main().catch(console.error);
