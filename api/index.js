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
            // 1. Revisar cuántos puntos tiene el usuario en Firebase
            const resPts = await fetch(`${baseUserUrl}/points.json`);
            let pts = await resPts.json();

            // Si es la primera vez que juega, le regalamos 500 puntos de bienvenida
            if (pts === null) pts = 500; 

            // 2. Comprobar si le alcanza
            if (pts < 200) {
                return res.status(200).send(`❌ @${user}, el gacha cuesta 200 pts (Solo tienes ${pts} pts).`);
            }

            // 3. Restarle los 200 puntos y guardar en la base de datos
            pts -= 200;
            await fetch(`${baseUserUrl}/points.json`, {
                method: 'PUT',
                body: JSON.stringify(pts)
            });

            // 4. Lógica del Gacha (elegir Pokémon y guardarlo)
            const pokemon = POKEMON_POOL[Math.floor(Math.random() * POKEMON_POOL.length)];
            const resInv = await fetch(`${baseUserUrl}/inventory.json`);
            let inv = (await resInv.json()) || [];
            if (!Array.isArray(inv)) inv = [];
            inv.push(pokemon);

            await fetch(`${baseUserUrl}/inventory.json`, {
                method: 'PUT',
                body: JSON.stringify(inv)
            });

            // 5. Avisar a la extensión visual para que salga el dibujo
            await fetch(`${FIREBASE_URL}/last_gacha_event.json`, {
                method: 'PUT',
                body: JSON.stringify({ username: user, pokemon, timestamp: Date.now() })
            });

            return res.status(200).send(`🎉 @${user} gastó 200 pts y obtuvo a ${pokemon.name}! (Te quedan ${pts} pts)`);
        }

        if (action === "inventario") {
            const resInv = await fetch(`${baseUserUrl}/inventory.json`);
            const inv = await resInv.json();

            if (inv && Array.isArray(inv) && inv.length > 0) {
                // Contar cuántos hay de cada uno
                const conteo = {};
                inv.forEach(p => {
                    conteo[p.name] = (conteo[p.name] || 0) + 1;
                });
                
                // Formatear la lista (ej: 2x Gengar, 1x Pikachu)
                const lista = Object.keys(conteo)
                    .map(name => `${conteo[name]}x ${name}`)
                    .join(", ");
                    
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
