const FIREBASE_URL = "https://kamis-57511-default-rtdb.firebaseio.com";

const POKEMON_POOL = [
    { id: 25, name: "Pikachu", rarity: "Común" },
    { id: 4, name: "Charmander", rarity: "Común" },
    { id: 94, name: "Gengar", rarity: "Raro" },
    { id: 150, name: "Mewtwo", rarity: "Legendario" }
];

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const { action } = req.query;
    const user = (req.query.user || "espectador").toLowerCase().replace(/[^a-z0-9_]/g, '');
    const baseUserUrl = `${FIREBASE_URL}/users/${encodeURIComponent(user)}`;

    try {
        if (action === "gacha") {
            const pokemon = POKEMON_POOL[Math.floor(Math.random() * POKEMON_POOL.length)];

            const resInv = await fetch(`${baseUserUrl}/inventory.json`);
            let inv = (await resInv.json()) || [];
            if (!Array.isArray(inv)) inv = [];
            inv.push(pokemon);

            await fetch(`${baseUserUrl}/inventory.json`, {
                method: 'PUT',
                body: JSON.stringify(inv)
            });

            await fetch(`${FIREBASE_URL}/last_gacha_event.json`, {
                method: 'PUT',
                body: JSON.stringify({ username: user, pokemon, timestamp: Date.now() })
            });

            return res.status(200).send(`🎉 @${user} obtuvo a ${pokemon.name} [ID:${pokemon.id}]`);
        }

        if (action === "inventario") {
            const resInv = await fetch(`${baseUserUrl}/inventory.json`);
            const inv = await resInv.json();

            if (inv && Array.isArray(inv) && inv.length > 0) {
                // Limitar la lista a los últimos 10 Pokémon para no pasar de 400 caracteres
                const lista = [...new Set(inv.map(p => `${p.name} (${p.id})`))].slice(-10).join(", ");
                return res.status(200).send(`🎒 @${user}: ${lista}`);
            }
            return res.status(200).send(`🎒 @${user} inventario vacío. Usa !gacha`);
        }

        if (action === "puntos") {
            const resPts = await fetch(`${baseUserUrl}/points.json`);
            const pts = await resPts.json();
            return res.status(200).send(`⭐ @${user} tienes ${pts || 0} pts.`);
        }

        if (action === "equipar") {
            const pokemonId = parseInt(req.query.id);
            if (!pokemonId) return res.status(200).send(`⚠️ @${user} usa: !equipar 25`);

            const resInv = await fetch(`${baseUserUrl}/inventory.json`);
            const inv = (await resInv.json()) || [];
            const pokemonEncontrado = Array.isArray(inv) && inv.find(p => p.id === pokemonId);

            if (!pokemonEncontrado) {
                return res.status(200).send(`❌ @${user} no tienes el ID ${pokemonId}.`);
            }

            await fetch(`${FIREBASE_URL}/last_equip_event.json`, {
                method: 'PUT',
                body: JSON.stringify({ username: user, pokemon: pokemonEncontrado, timestamp: Date.now() })
            });

            return res.status(200).send(`⚡ @${user} equipó a ${pokemonEncontrado.name} en pantalla!`);
        }

        return res.status(400).send("Comando inválido");

    } catch (e) {
        return res.status(500).send("Error de conexión");
    }
};