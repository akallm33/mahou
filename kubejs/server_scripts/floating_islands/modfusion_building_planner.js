console.log("[ModFusion Building Planner] Island planner v1 loading")


/*
 * =========================================================
 * ModFusion Building Planner - Island Architecture v1
 * =========================================================
 *
 * Pure deterministic planning only.
 *
 * This file reproduces the 64-bit positional random algorithm used by
 * More Density Functions 2.3.0 for the middle-island Worley grid.
 * Given the same world seed and cell coordinates, it can recover the
 * actual island centre without reading blocks or loading chunks.
 *
 * It never:
 *   - reads terrain, heightmaps, chunks, or biomes;
 *   - calls getChunk();
 *   - places structures;
 *   - writes persistent world state;
 *   - registers tick or chunk events.
 */


var MODFUSION_BUILDING_PLANNER_SCHEMA_VERSION = 1


var MODFUSION_BUILDING_PLANNER_CONFIG = {
    dimensionId: "mahou:modfusion_dimension",

    layerId: "MIDDLE",

    gridSizeBlocks: 768,
    gridHalfSizeBlocks: 384,

    islandSalt: 104729,

    jitterMin: 146.0,
    jitterMax: 622.0,

    radiusMin: 150.0,
    radiusRange: 80.0,

    surfaceY: 72,

    buildingSalt: 7321441,
    buildingChance: 1.0,

    reservedCells: {
        "0:0": true
    }
}


/*
 * =========================================================
 * Unsigned 64-bit arithmetic
 * =========================================================
 *
 * Rhino/JavaScript numbers cannot represent every Java long exactly.
 * A long is therefore stored as four little-endian unsigned 16-bit limbs:
 *
 *   [bits 0..15, bits 16..31, bits 32..47, bits 48..63]
 *
 * No BigInt syntax or blocked Java utility class is required.
 */


var MODFUSION_PLANNER_LONG_BASE = 65536
var MODFUSION_PLANNER_LONG_MASK = 65535

/*
 * Every loop used by the planner must have a hard upper bound because the
 * planner is called from the integrated-server tick thread.  In particular,
 * Rhino and Node do not always make identical optimisation/number choices;
 * an unbounded rejection sampler can otherwise freeze the whole game.
 */
var MODFUSION_PLANNER_MAX_DECIMAL_DIGITS = 20
var MODFUSION_PLANNER_GAMMA_MAX_ATTEMPTS = 64
var MODFUSION_PLANNER_GAMMA_MAX_POSITIVE_ATTEMPTS = 16


function modfusionPlannerLongZero()
{
    return [0, 0, 0, 0]
}


function modfusionPlannerLongClone(value)
{
    return [value[0], value[1], value[2], value[3]]
}


function modfusionPlannerLongFromHex(value)
{
    var text = String(value).replace(/^0x/i, "")

    while(text.length < 16)
    {
        text = "0" + text
    }

    return [
        parseInt(text.substring(12, 16), 16),
        parseInt(text.substring(8, 12), 16),
        parseInt(text.substring(4, 8), 16),
        parseInt(text.substring(0, 4), 16)
    ]
}


function modfusionPlannerLongFromUnsigned32(value)
{
    var number = Number(value) >>> 0

    return [
        number & MODFUSION_PLANNER_LONG_MASK,
        (number >>> 16) & MODFUSION_PLANNER_LONG_MASK,
        0,
        0
    ]
}


function modfusionPlannerLongFromSigned32(value)
{
    var number = Number(value) | 0
    var high = number < 0 ? MODFUSION_PLANNER_LONG_MASK : 0

    return [
        number & MODFUSION_PLANNER_LONG_MASK,
        (number >>> 16) & MODFUSION_PLANNER_LONG_MASK,
        high,
        high
    ]
}


function modfusionPlannerLongNormalize(raw)
{
    var result = [raw[0], raw[1], raw[2], raw[3]]
    var carry = 0
    var i

    for(i = 0; i < 4; i++)
    {
        var value = result[i] + carry
        carry = Math.floor(value / MODFUSION_PLANNER_LONG_BASE)
        result[i] = value - carry * MODFUSION_PLANNER_LONG_BASE
    }

    return result
}


function modfusionPlannerLongAdd(left, right)
{
    return modfusionPlannerLongNormalize([
        left[0] + right[0],
        left[1] + right[1],
        left[2] + right[2],
        left[3] + right[3]
    ])
}


function modfusionPlannerLongNot(value)
{
    return [
        MODFUSION_PLANNER_LONG_MASK - value[0],
        MODFUSION_PLANNER_LONG_MASK - value[1],
        MODFUSION_PLANNER_LONG_MASK - value[2],
        MODFUSION_PLANNER_LONG_MASK - value[3]
    ]
}


function modfusionPlannerLongNegate(value)
{
    return modfusionPlannerLongAdd(
        modfusionPlannerLongNot(value),
        [1, 0, 0, 0]
    )
}


function modfusionPlannerLongXor(left, right)
{
    return [
        (left[0] ^ right[0]) & MODFUSION_PLANNER_LONG_MASK,
        (left[1] ^ right[1]) & MODFUSION_PLANNER_LONG_MASK,
        (left[2] ^ right[2]) & MODFUSION_PLANNER_LONG_MASK,
        (left[3] ^ right[3]) & MODFUSION_PLANNER_LONG_MASK
    ]
}


function modfusionPlannerLongOr(left, right)
{
    return [
        (left[0] | right[0]) & MODFUSION_PLANNER_LONG_MASK,
        (left[1] | right[1]) & MODFUSION_PLANNER_LONG_MASK,
        (left[2] | right[2]) & MODFUSION_PLANNER_LONG_MASK,
        (left[3] | right[3]) & MODFUSION_PLANNER_LONG_MASK
    ]
}


function modfusionPlannerLongMultiply(left, right)
{
    var raw = [0, 0, 0, 0]
    var i
    var j

    for(i = 0; i < 4; i++)
    {
        for(j = 0; j + i < 4; j++)
        {
            raw[i + j] += left[i] * right[j]
        }
    }

    return modfusionPlannerLongNormalize(raw)
}


function modfusionPlannerLongShiftLeft(value, amount)
{
    var shift = Math.floor(Number(amount))

    if(shift <= 0)
    {
        return modfusionPlannerLongClone(value)
    }

    if(shift >= 64)
    {
        return modfusionPlannerLongZero()
    }

    var limbShift = Math.floor(shift / 16)
    var bitShift = shift % 16
    var factor = Math.pow(2, bitShift)
    var raw = [0, 0, 0, 0]
    var i

    for(i = 0; i < 4; i++)
    {
        var target = i + limbShift

        if(target >= 4)
        {
            continue
        }

        var product = value[i] * factor
        raw[target] += product % MODFUSION_PLANNER_LONG_BASE

        if(target + 1 < 4)
        {
            raw[target + 1] += Math.floor(
                product / MODFUSION_PLANNER_LONG_BASE
            )
        }
    }

    return modfusionPlannerLongNormalize(raw)
}


function modfusionPlannerLongShiftRight(value, amount)
{
    var shift = Math.floor(Number(amount))

    if(shift <= 0)
    {
        return modfusionPlannerLongClone(value)
    }

    if(shift >= 64)
    {
        return modfusionPlannerLongZero()
    }

    var limbShift = Math.floor(shift / 16)
    var bitShift = shift % 16
    var divisor = Math.pow(2, bitShift)
    var carryFactor = Math.pow(2, 16 - bitShift)
    var result = [0, 0, 0, 0]
    var target

    for(target = 0; target + limbShift < 4; target++)
    {
        var source = target + limbShift
        var output = Math.floor(value[source] / divisor)

        if(bitShift > 0 && source + 1 < 4)
        {
            output += (value[source + 1] % divisor) * carryFactor
        }

        result[target] = output
    }

    return result
}


function modfusionPlannerLongDivideSmall(value, divisor)
{
    var result = [0, 0, 0, 0]
    var remainder = 0
    var i

    for(i = 3; i >= 0; i--)
    {
        var current = remainder * MODFUSION_PLANNER_LONG_BASE + value[i]
        result[i] = Math.floor(current / divisor)
        remainder = current % divisor
    }

    return {
        quotient: result,
        remainder: remainder
    }
}


function modfusionPlannerLongIsZero(value)
{
    return value[0] === 0 &&
        value[1] === 0 &&
        value[2] === 0 &&
        value[3] === 0
}


function modfusionPlannerLongParseDecimal(value)
{
    var text = String(value).trim()

    if(/^-?[0-9]+[lL]$/.test(text))
    {
        text = text.substring(0, text.length - 1)
    }

    if(!/^-?[0-9]+$/.test(text))
    {
        throw new Error(
            "[ModFusion Building Planner] Invalid decimal world seed: " +
            text
        )
    }

    var negative = text.charAt(0) === "-"
    var start = negative ? 1 : 0
    var result = modfusionPlannerLongZero()
    var ten = [10, 0, 0, 0]
    var i

    for(i = start; i < text.length; i++)
    {
        result = modfusionPlannerLongMultiply(result, ten)
        result = modfusionPlannerLongAdd(
            result,
            [parseInt(text.charAt(i), 10), 0, 0, 0]
        )
    }

    return negative
        ? modfusionPlannerLongNegate(result)
        : result
}


function modfusionPlannerLongToDecimal(value)
{
    var negative = (value[3] & 32768) !== 0
    var remaining = negative
        ? modfusionPlannerLongNegate(value)
        : modfusionPlannerLongClone(value)

    if(modfusionPlannerLongIsZero(remaining))
    {
        return "0"
    }

    var digits = []

    var digitCount = 0

    while(
        !modfusionPlannerLongIsZero(remaining) &&
        digitCount < MODFUSION_PLANNER_MAX_DECIMAL_DIGITS
    )
    {
        var division = modfusionPlannerLongDivideSmall(remaining, 10)
        digits.push(String(division.remainder))
        remaining = division.quotient
        digitCount++
    }

    if(!modfusionPlannerLongIsZero(remaining))
    {
        throw new Error(
            "[ModFusion Building Planner] 64-bit decimal conversion " +
            "did not converge within " +
            MODFUSION_PLANNER_MAX_DECIMAL_DIGITS +
            " digits"
        )
    }

    digits.reverse()

    return (negative ? "-" : "") + digits.join("")
}


function modfusionPlannerNormalizeWorldSeed(value)
{
    if(Array.isArray(value) && value.length === 4)
    {
        return [
            Number(value[0]) & MODFUSION_PLANNER_LONG_MASK,
            Number(value[1]) & MODFUSION_PLANNER_LONG_MASK,
            Number(value[2]) & MODFUSION_PLANNER_LONG_MASK,
            Number(value[3]) & MODFUSION_PLANNER_LONG_MASK
        ]
    }

    if(typeof value === "number")
    {
        if(
            !isFinite(value) ||
            Math.floor(value) !== value ||
            Math.abs(value) > 9007199254740991
        )
        {
            throw new Error(
                "[ModFusion Building Planner] World seed number is not " +
                "a safe integer. Pass the seed as a decimal string."
            )
        }
    }

    return modfusionPlannerLongParseDecimal(String(value))
}


/*
 * =========================================================
 * MoreDFs positional random implementation
 * =========================================================
 */


var MODFUSION_PLANNER_HASH_XY =
    modfusionPlannerLongFromHex("4c308559194eb04f")

var MODFUSION_PLANNER_HASH_ZSALT =
    modfusionPlannerLongFromHex("7c3b877d5938ea13")

var MODFUSION_PLANNER_HASH_FINAL =
    modfusionPlannerLongFromHex("5388111110649c65")

var MODFUSION_PLANNER_MIX_MULTIPLIER =
    modfusionPlannerLongFromHex("5851f42d4c957f2d")

var MODFUSION_PLANNER_MIX_INCREMENT =
    modfusionPlannerLongFromHex("14057b7ef767814f")

var MODFUSION_PLANNER_MIX_FINAL =
    modfusionPlannerLongFromHex("c6a4a7935bd1e995")


function modfusionPlannerValidateInt32(value, fieldName)
{
    var number = Number(value)

    if(
        !isFinite(number) ||
        Math.floor(number) !== number ||
        number < -2147483648 ||
        number > 2147483647
    )
    {
        throw new Error(
            "[ModFusion Building Planner] " + fieldName +
            " must be a signed 32-bit integer"
        )
    }

    return number
}


function modfusionPlannerPackXY(x, y)
{
    var high = modfusionPlannerLongShiftLeft(
        modfusionPlannerLongFromSigned32(x),
        32
    )

    var low = modfusionPlannerLongAdd(
        modfusionPlannerLongFromUnsigned32(y),
        [31, 0, 0, 0]
    )

    return modfusionPlannerLongOr(high, low)
}


function modfusionPlannerPackZSalt(z, salt)
{
    var high = modfusionPlannerLongShiftLeft(
        modfusionPlannerLongFromSigned32(z),
        32
    )

    var low = modfusionPlannerLongAdd(
        modfusionPlannerLongFromUnsigned32(salt),
        [1337, 0, 0, 0]
    )

    return modfusionPlannerLongOr(high, low)
}


function modfusionPlannerHashPosition(worldSeed, x, y, z, salt)
{
    var seed = modfusionPlannerLongClone(worldSeed)
    var xy = modfusionPlannerPackXY(x, y)
    var zsalt = modfusionPlannerPackZSalt(z, salt)

    seed = modfusionPlannerLongXor(
        seed,
        modfusionPlannerLongMultiply(xy, MODFUSION_PLANNER_HASH_XY)
    )

    seed = modfusionPlannerLongXor(
        seed,
        modfusionPlannerLongMultiply(
            zsalt,
            MODFUSION_PLANNER_HASH_ZSALT
        )
    )

    seed = modfusionPlannerLongMultiply(
        seed,
        MODFUSION_PLANNER_HASH_FINAL
    )

    return modfusionPlannerLongXor(
        seed,
        modfusionPlannerLongShiftLeft(seed, 19)
    )
}


function modfusionPlannerMix(seed)
{
    var next = modfusionPlannerLongAdd(
        modfusionPlannerLongMultiply(
            seed,
            MODFUSION_PLANNER_MIX_MULTIPLIER
        ),
        MODFUSION_PLANNER_MIX_INCREMENT
    )

    var variableShift = (next[3] >>> 11) + 5

    var mixed = modfusionPlannerLongMultiply(
        modfusionPlannerLongXor(
            modfusionPlannerLongShiftRight(next, variableShift),
            next
        ),
        MODFUSION_PLANNER_MIX_FINAL
    )

    return modfusionPlannerLongXor(
        modfusionPlannerLongShiftRight(mixed, 43),
        mixed
    )
}


function modfusionPlannerSampleDouble(seed)
{
    var shifted = modfusionPlannerLongShiftRight(seed, 11)

    var integer =
        shifted[0] +
        shifted[1] * 65536 +
        shifted[2] * 4294967296 +
        shifted[3] * 281474976710656

    return integer / 9007199254740992
}


function modfusionPlannerSampleGaussian(seed)
{
    var u1 = modfusionPlannerSampleDouble(seed)
    var u2 = modfusionPlannerSampleDouble(modfusionPlannerMix(seed))

    if(u1 < 1.0e-15)
    {
        u1 = 1.0e-15
    }

    return Math.sqrt(-2.0 * Math.log(u1)) *
        Math.cos(2.0 * Math.PI * u2)
}


function modfusionPlannerSampleGammaShapeOne(seed)
{
    var current = modfusionPlannerLongClone(seed)
    var shapeMinusOneThird = 2.0 / 3.0
    var inverseSqrtShape = 1.0 / Math.sqrt(6.0)
    var attempt

    for(
        attempt = 0;
        attempt < MODFUSION_PLANNER_GAMMA_MAX_ATTEMPTS;
        attempt++
    )
    {
        var x
        var v
        var positiveAttempt
        var hasPositiveV = false

        for(
            positiveAttempt = 0;
            positiveAttempt <
                MODFUSION_PLANNER_GAMMA_MAX_POSITIVE_ATTEMPTS;
            positiveAttempt++
        )
        {
            x = modfusionPlannerSampleGaussian(current)
            current = modfusionPlannerMix(current)
            v = 1.0 + inverseSqrtShape * x

            if(isFinite(v) && v > 0.0)
            {
                hasPositiveV = true
                break
            }
        }

        if(!hasPositiveV)
        {
            continue
        }

        v = v * v * v

        var u = modfusionPlannerSampleDouble(current)

        if(
            !isFinite(x) ||
            !isFinite(v) ||
            v <= 0.0 ||
            !isFinite(u) ||
            u < 0.0 ||
            u >= 1.0
        )
        {
            continue
        }

        if(u < 1.0 - 0.0331 * x * x * x * x)
        {
            return shapeMinusOneThird * v
        }

        if(
            Math.log(u) <
            0.5 * x * x +
            shapeMinusOneThird * (1.0 - v + Math.log(v))
        )
        {
            return shapeMinusOneThird * v
        }
    }

    /*
     * Gamma(shape=1) is an exponential distribution.  This deterministic
     * inverse-CDF fallback keeps the planner finite if Rhino ever rejects all
     * bounded Marsaglia-Tsang attempts.  Normal seeds still use the exact
     * sampler path above.
     */
    var fallbackU = modfusionPlannerSampleDouble(
        modfusionPlannerMix(current)
    )

    if(!isFinite(fallbackU) || fallbackU < 0.0 || fallbackU >= 1.0)
    {
        fallbackU = 0.5
    }

    return -Math.log(1.0 - fallbackU)
}


function modfusionPlannerSampleBetaOneOne(seed)
{
    var x = modfusionPlannerSampleGammaShapeOne(seed)

    var ySeed = modfusionPlannerMix(
        modfusionPlannerLongAdd(seed, [1, 0, 0, 0])
    )

    var y = modfusionPlannerSampleGammaShapeOne(ySeed)

    var total = x + y

    if(
        isFinite(x) &&
        isFinite(y) &&
        x >= 0.0 &&
        y >= 0.0 &&
        isFinite(total) &&
        total > 0.0
    )
    {
        return x / total
    }

    /* Beta(1, 1) is uniform, so this is a distribution-preserving fallback. */
    var fallback = modfusionPlannerSampleDouble(
        modfusionPlannerMix(ySeed)
    )

    return isFinite(fallback) && fallback >= 0.0 && fallback < 1.0
        ? fallback
        : 0.5
}


function modfusionPlannerSafeModulo(value, divisor)
{
    if(divisor === 0.0)
    {
        return 0.0
    }

    return ((value % divisor) + divisor) % divisor
}


function modfusionPlannerSampleUniform(seed, minimum, maximum)
{
    return minimum +
        (maximum - minimum) * modfusionPlannerSampleDouble(seed)
}


/*
 * =========================================================
 * Grid and island calculations
 * =========================================================
 */


function modfusionPlannerReadCoordinate(value, fieldName)
{
    var number = Number(value)

    if(!isFinite(number))
    {
        throw new Error(
            "[ModFusion Building Planner] " + fieldName +
            " must be finite"
        )
    }

    return Math.floor(number)
}


function modfusionPlannerGetCell(cellX, cellZ)
{
    var x = modfusionPlannerValidateInt32(cellX, "cellX")
    var z = modfusionPlannerValidateInt32(cellZ, "cellZ")
    var size = MODFUSION_BUILDING_PLANNER_CONFIG.gridSizeBlocks
    var half = MODFUSION_BUILDING_PLANNER_CONFIG.gridHalfSizeBlocks

    return {
        x: x,
        z: z,
        key: x + ":" + z,

        minBlockX: x * size - half,
        maxBlockX: x * size + half - 1,
        minBlockZ: z * size - half,
        maxBlockZ: z * size + half - 1,

        minChunkX: x * 48 - 24,
        maxChunkX: x * 48 + 23,
        minChunkZ: z * 48 - 24,
        maxChunkZ: z * 48 + 23
    }
}


function modfusionPlannerGetCellAtBlock(blockX, blockZ)
{
    var x = modfusionPlannerReadCoordinate(blockX, "blockX")
    var z = modfusionPlannerReadCoordinate(blockZ, "blockZ")
    var size = MODFUSION_BUILDING_PLANNER_CONFIG.gridSizeBlocks
    var half = MODFUSION_BUILDING_PLANNER_CONFIG.gridHalfSizeBlocks

    return modfusionPlannerGetCell(
        Math.floor((x + half) / size),
        Math.floor((z + half) / size)
    )
}


function modfusionPlannerGetIsland(worldSeed, cellX, cellZ)
{
    var seed = modfusionPlannerNormalizeWorldSeed(worldSeed)
    var cell = modfusionPlannerGetCell(cellX, cellZ)
    var config = MODFUSION_BUILDING_PLANNER_CONFIG

    var siteHash = modfusionPlannerHashPosition(
        seed,
        cell.x,
        0,
        cell.z,
        config.islandSalt
    )

    var jitterX = modfusionPlannerSafeModulo(
        modfusionPlannerSampleUniform(
            siteHash,
            config.jitterMin,
            config.jitterMax
        ),
        config.gridSizeBlocks
    ) - config.gridHalfSizeBlocks

    siteHash = modfusionPlannerMix(siteHash)
    siteHash = modfusionPlannerMix(siteHash)

    var jitterZ = modfusionPlannerSafeModulo(
        modfusionPlannerSampleUniform(
            siteHash,
            config.jitterMin,
            config.jitterMax
        ),
        config.gridSizeBlocks
    ) - config.gridHalfSizeBlocks

    var centerX = cell.x * config.gridSizeBlocks + jitterX
    var centerZ = cell.z * config.gridSizeBlocks + jitterZ

    var islandRandom = modfusionPlannerSampleBetaOneOne(siteHash)
    var radius = config.radiusMin + config.radiusRange * islandRandom

    var biomeRandom = modfusionPlannerSafeModulo(
        islandRandom * 8191.0 + 0.38196601125,
        1.0
    )

    return {
        layerId: config.layerId,
        cell: cell,

        centerX: centerX,
        centerZ: centerZ,

        blockX: Math.floor(centerX + 0.5),
        blockZ: Math.floor(centerZ + 0.5),

        jitterX: jitterX,
        jitterZ: jitterZ,

        radius: radius,
        surfaceY: config.surfaceY,

        islandRandom: islandRandom,
        biomeSelector: -1.0 + biomeRandom * 2.0
    }
}


/*
 * =========================================================
 * Building planning
 * =========================================================
 */


function modfusionPlannerIsReservedCell(cellKey)
{
    return MODFUSION_BUILDING_PLANNER_CONFIG.reservedCells[cellKey] === true
}


function modfusionPlannerChooseWeighted(buildings, roll)
{
    if(
        global.ModfusionBuildingRegistry == null ||
        !Array.isArray(buildings) ||
        buildings.length <= 0
    )
    {
        return null
    }

    var total = global.ModfusionBuildingRegistry.getTotalWeight(buildings)

    if(!isFinite(total) || total <= 0.0)
    {
        return null
    }

    var target = roll * total
    var cumulative = 0.0
    var i

    for(i = 0; i < buildings.length; i++)
    {
        var weight = Number(buildings[i].selection.weight)

        if(isFinite(weight) && weight > 0.0)
        {
            cumulative += weight

            if(target < cumulative)
            {
                return buildings[i]
            }
        }
    }

    return buildings[buildings.length - 1]
}


function modfusionPlannerCreateFootprint(building, blockX, blockZ)
{
    var centerChunkX = Math.floor(blockX / 16)
    var centerChunkZ = Math.floor(blockZ / 16)
    var radius = building.placement.footprintRadiusChunks

    return {
        centerChunkX: centerChunkX,
        centerChunkZ: centerChunkZ,
        radiusChunks: radius,

        minChunkX: centerChunkX - radius,
        maxChunkX: centerChunkX + radius,
        minChunkZ: centerChunkZ - radius,
        maxChunkZ: centerChunkZ + radius,

        chunkCount: (radius * 2 + 1) * (radius * 2 + 1),
        waitForFootprint: building.placement.waitForFootprint === true
    }
}


function modfusionPlannerGetRotation(building, roll)
{
    var quarterTurns = Math.floor(roll * 4.0) % 4
    var names = [
        "NONE",
        "CLOCKWISE_90",
        "CLOCKWISE_180",
        "COUNTERCLOCKWISE_90"
    ]

    if(building.placement.rotationMode !== "DETERMINISTIC_QUARTER_TURN")
    {
        return {
            mode: building.placement.rotationMode,
            quarterTurns: 0,
            name: building.placement.rotationMode
        }
    }

    return {
        mode: building.placement.rotationMode,
        quarterTurns: quarterTurns,
        name: names[quarterTurns]
    }
}


function planModfusionBuilding(worldSeed, cellX, cellZ)
{
    var cell = modfusionPlannerGetCell(cellX, cellZ)

    /*
     * Cell 0:0 contains the dedicated spawn template.  Return before any
     * seed conversion or random sampling so entering the dimension can never
     * be blocked by the building planner.
     */
    if(modfusionPlannerIsReservedCell(cell.key))
    {
        return {
            schemaVersion: MODFUSION_BUILDING_PLANNER_SCHEMA_VERSION,
            worldSeed: String(worldSeed),
            cell: cell,
            island: {
                layerId: MODFUSION_BUILDING_PLANNER_CONFIG.layerId,
                cell: cell,
                radius: MODFUSION_BUILDING_PLANNER_CONFIG.radiusMin,
                surfaceY: MODFUSION_BUILDING_PLANNER_CONFIG.surfaceY,
                reserved: true
            },
            status: "RESERVED",
            reason: "RESERVED_CELL"
        }
    }

    var seed = modfusionPlannerNormalizeWorldSeed(worldSeed)
    var seedText = modfusionPlannerLongToDecimal(seed)
    var island = modfusionPlannerGetIsland(seed, cellX, cellZ)
    cell = island.cell

    var base = {
        schemaVersion: MODFUSION_BUILDING_PLANNER_SCHEMA_VERSION,
        worldSeed: seedText,
        cell: cell,
        island: island
    }

    if(global.ModfusionBuildingRegistry == null)
    {
        base.status = "BLOCKED"
        base.reason = "BUILDING_REGISTRY_NOT_LOADED"
        return base
    }

    var buildings = global.ModfusionBuildingRegistry.getEnabledForIsland(
        island.layerId,
        island.radius
    )

    if(!Array.isArray(buildings) || buildings.length <= 0)
    {
        base.status = "SKIPPED"
        base.reason = "NO_ELIGIBLE_BUILDINGS"
        return base
    }

    var random = modfusionPlannerHashPosition(
        seed,
        cell.x,
        0,
        cell.z,
        MODFUSION_BUILDING_PLANNER_CONFIG.buildingSalt
    )

    var chanceRoll = modfusionPlannerSampleDouble(random)
    random = modfusionPlannerMix(random)
    var selectionRoll = modfusionPlannerSampleDouble(random)
    random = modfusionPlannerMix(random)
    var rotationRoll = modfusionPlannerSampleDouble(random)

    base.random = {
        chance: chanceRoll,
        selection: selectionRoll,
        rotation: rotationRoll
    }

    if(chanceRoll >= MODFUSION_BUILDING_PLANNER_CONFIG.buildingChance)
    {
        base.status = "SKIPPED"
        base.reason = "BUILDING_CHANCE"
        return base
    }

    var building = modfusionPlannerChooseWeighted(
        buildings,
        selectionRoll
    )

    if(building == null)
    {
        base.status = "SKIPPED"
        base.reason = "WEIGHT_SELECTION_FAILED"
        return base
    }

    var placementX = island.blockX
    var placementY = island.surfaceY + building.placement.yOffset
    var placementZ = island.blockZ

    base.status = "PLANNED"
    base.reason = null
    base.buildingId = building.id
    base.building = building

    base.placement = {
        adapterId: building.placement.adapterId,
        targetId: building.placement.targetId,

        x: placementX,
        y: placementY,
        z: placementZ,

        exactY: building.placement.exactY === true,
        rotation: modfusionPlannerGetRotation(building, rotationRoll),
        footprint: modfusionPlannerCreateFootprint(
            building,
            placementX,
            placementZ
        )
    }

    return base
}


function planModfusionBuildingAtBlock(worldSeed, blockX, blockZ)
{
    var cell = modfusionPlannerGetCellAtBlock(blockX, blockZ)

    return planModfusionBuilding(worldSeed, cell.x, cell.z)
}


/*
 * =========================================================
 * Public API
 * =========================================================
 */


global.ModfusionBuildingPlanner = {
    schemaVersion: MODFUSION_BUILDING_PLANNER_SCHEMA_VERSION,

    getConfig: function()
    {
        return JSON.parse(JSON.stringify(MODFUSION_BUILDING_PLANNER_CONFIG))
    },

    normalizeSeed: function(worldSeed)
    {
        return modfusionPlannerLongToDecimal(
            modfusionPlannerNormalizeWorldSeed(worldSeed)
        )
    },

    getCell: modfusionPlannerGetCell,
    getCellAtBlock: modfusionPlannerGetCellAtBlock,
    getIsland: modfusionPlannerGetIsland,

    plan: planModfusionBuilding,
    planAtBlock: planModfusionBuildingAtBlock,

    debugHash: function(worldSeed, x, y, z, salt)
    {
        var seed = modfusionPlannerNormalizeWorldSeed(worldSeed)

        return modfusionPlannerLongToDecimal(
            modfusionPlannerHashPosition(
                seed,
                modfusionPlannerValidateInt32(x, "x"),
                modfusionPlannerValidateInt32(y, "y"),
                modfusionPlannerValidateInt32(z, "z"),
                modfusionPlannerValidateInt32(salt, "salt")
            )
        )
    }
}


console.log(
    "[ModFusion Building Planner] Island planner v1 ready. " +
    "Grid=" + MODFUSION_BUILDING_PLANNER_CONFIG.gridSizeBlocks +
    " blocks, islandSalt=" +
    MODFUSION_BUILDING_PLANNER_CONFIG.islandSalt +
    ", buildingChance=" +
    MODFUSION_BUILDING_PLANNER_CONFIG.buildingChance
)
