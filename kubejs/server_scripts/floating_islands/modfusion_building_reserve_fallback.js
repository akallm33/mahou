console.log(
    "[ModFusion Reserve Fallback] Script loaded"
)


/*
 * =========================================================
 * Settings
 * =========================================================
 */

var MODFUSION_RESERVE_DIMENSION_ID =
    "mahou:modfusion_dimension"


var MODFUSION_RESERVE_VERSION =
    1


/*
 * =========================================================
 * Deterministic hash
 * =========================================================
 */

function modfusionReserveHashString(
    text
)
{
    text =
        String(text)


    var hash =
        0x811C9DC5


    var i


    for(
        i = 0;
        i < text.length;
        i++
    )
    {
        hash ^=
            text.charCodeAt(i)


        hash =
            (
                hash +
                (hash << 1) +
                (hash << 4) +
                (hash << 7) +
                (hash << 8) +
                (hash << 24)
            ) | 0
    }


    return hash >>> 0
}


/*
 * =========================================================
 * PRNG
 * =========================================================
 */

function createModfusionReserveRandom(
    seed
)
{
    var state =
        seed >>> 0


    if(state === 0)
    {
        state =
            0x6D2B79F5
    }


    return function()
    {
        state ^=
            state << 13


        state ^=
            state >>> 17


        state ^=
            state << 5


        return (
            (state >>> 0) /
            4294967296
        )
    }
}


/*
 * =========================================================
 * Shuffle
 * =========================================================
 */

function shuffleModfusionReserveArray(
    array,
    seed
)
{
    var result =
        array.slice()


    var random =
        createModfusionReserveRandom(
            seed
        )


    var i


    for(
        i = result.length - 1;
        i > 0;
        i--
    )
    {
        var j =
            Math.floor(
                random() *
                (i + 1)
            )


        var temp =
            result[i]


        result[i] =
            result[j]


        result[j] =
            temp
    }


    return result
}


/*
 * =========================================================
 * Region key
 * =========================================================
 */

function getModfusionReserveRegionKey(
    regionX,
    regionZ
)
{
    return (
        String(regionX) +
        "|" +
        String(regionZ)
    )
}


/*
 * =========================================================
 * Build static 1:1 Home ↔ Reserve pairing
 * =========================================================
 *
 * IMPORTANT:
 *
 * 这里只建立“所有权关系”。
 *
 * 不扫描地形。
 * 不调用 Analyzer。
 * 不生成 chunk。
 *
 *
 * 例如：
 *
 * Home A -> Reserve F
 * Home B -> Reserve C
 * Home C -> Reserve H
 *
 *
 * 一旦 Seed 确定，
 * 永久相同。
 */

function getModfusionReservePairingPlan(
    level,
    superX,
    superZ
)
{
    /*
     * =====================================================
     * Dependencies
     * =====================================================
     */

    if(level == null)
    {
        return {

            status:
                "ERROR",

            reason:
                "LEVEL_IS_NULL"
        }
    }


    if(
        global.ModfusionBuildingDistributor ==
        null
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "DISTRIBUTOR_NOT_LOADED"
        }
    }


    /*
     * =====================================================
     * Dimension
     * =====================================================
     */

    var dimensionId =
        String(
            level.dimension
        )


    if(
        dimensionId !==
        MODFUSION_RESERVE_DIMENSION_ID
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "WRONG_DIMENSION"
        }
    }


    superX =
        Math.floor(
            Number(superX)
        )


    superZ =
        Math.floor(
            Number(superZ)
        )


    /*
     * =====================================================
     * Distributor plan
     * =====================================================
     */

    var distributionPlan =
        global.ModfusionBuildingDistributor
            .getSuperRegionPlan(
                level,
                superX,
                superZ
            )


    if(
        distributionPlan == null ||
        distributionPlan.status !== "OK"
    )
    {
        return {

            status:
                "ERROR",

            reason:
                (
                    distributionPlan != null &&
                    distributionPlan.reason != null
                )
                ? distributionPlan.reason
                : "DISTRIBUTION_PLAN_FAILED"
        }
    }


    var side =
        Number(
            distributionPlan.side
        )


    if(
        isNaN(side) ||
        side <= 0
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "INVALID_SUPER_REGION_SIDE"
        }
    }


    side =
        Math.floor(
            side
        )


    /*
     * =====================================================
     * Discover Home / Reserve physical Regions
     * =====================================================
     */

    var homes = []

    var reserves = []


    var localX
    var localZ


    for(
        localZ = 0;
        localZ < side;
        localZ++
    )
    {
        for(
            localX = 0;
            localX < side;
            localX++
        )
        {
            var regionX =
                (
                    superX *
                    side
                ) +
                localX


            var regionZ =
                (
                    superZ *
                    side
                ) +
                localZ


            var localIndex =
                (
                    localZ *
                    side
                ) +
                localX


            var assignment =
                global.ModfusionBuildingDistributor
                    .getAssignmentForRegion(
                        level,
                        regionX,
                        regionZ
                    )


            if(
                assignment == null ||
                assignment.status !== "OK"
            )
            {
                return {

                    status:
                        "ERROR",

                    reason:
                        "REGION_ASSIGNMENT_FAILED",

                    regionX:
                        regionX,

                    regionZ:
                        regionZ
                }
            }


            var regionInfo = {

                regionX:
                    regionX,

                regionZ:
                    regionZ,

                localX:
                    localX,

                localZ:
                    localZ,

                localIndex:
                    localIndex
            }


            if(assignment.active)
            {
                regionInfo.buildingId =
                    String(
                        assignment.buildingId
                    )


                homes.push(
                    regionInfo
                )
            }
            else
            {
                reserves.push(
                    regionInfo
                )
            }
        }
    }


    /*
     * =====================================================
     * Deterministic pairing seed
     * =====================================================
     */

    var baseSeedText =
        String(
            distributionPlan.seedHash
        ) +
        "|reserve_pairing_v" +
        MODFUSION_RESERVE_VERSION +
        "|" +
        superX +
        "|" +
        superZ


    /*
     * =====================================================
     * Shuffle Home and Reserve separately
     * =====================================================
     */

    var shuffledHomes =
        shuffleModfusionReserveArray(
            homes,
            modfusionReserveHashString(
                baseSeedText +
                "|homes"
            )
        )


    var shuffledReserves =
        shuffleModfusionReserveArray(
            reserves,
            modfusionReserveHashString(
                baseSeedText +
                "|reserves"
            )
        )


    /*
     * =====================================================
     * Pair
     * =====================================================
     */

    var pairCount =
        Math.min(
            shuffledHomes.length,
            shuffledReserves.length
        )


    var pairs = []

    var homeMap = {}

    var reserveMap = {}


    var i


    for(
        i = 0;
        i < pairCount;
        i++
    )
    {
        var home =
            shuffledHomes[i]


        var reserve =
            shuffledReserves[i]


        var pair = {

            pairIndex:
                i,

            buildingId:
                home.buildingId,

            home:
                home,

            reserve:
                reserve
        }


        pairs.push(
            pair
        )


        homeMap[
            getModfusionReserveRegionKey(
                home.regionX,
                home.regionZ
            )
        ] =
            pair


        reserveMap[
            getModfusionReserveRegionKey(
                reserve.regionX,
                reserve.regionZ
            )
        ] =
            pair
    }


    /*
     * =====================================================
     * Homes without Reserve
     * =====================================================
     *
     * 当前 4/4/8 不会出现。
     *
     * 但代码对未来 active ratio 修改保持安全。
     */

    var unpairedHomes = []


    for(
        i = pairCount;
        i < shuffledHomes.length;
        i++
    )
    {
        var unpairedHome =
            shuffledHomes[i]


        unpairedHomes.push(
            unpairedHome
        )


        homeMap[
            getModfusionReserveRegionKey(
                unpairedHome.regionX,
                unpairedHome.regionZ
            )
        ] = {

            pairIndex:
                -1,

            buildingId:
                unpairedHome.buildingId,

            home:
                unpairedHome,

            reserve:
                null
        }
    }


    /*
     * =====================================================
     * Extra Reserve
     * =====================================================
     */

    var unpairedReserves = []


    for(
        i = pairCount;
        i < shuffledReserves.length;
        i++
    )
    {
        unpairedReserves.push(
            shuffledReserves[i]
        )
    }


    return {

        status:
            "OK",

        version:
            MODFUSION_RESERVE_VERSION,

        superX:
            superX,

        superZ:
            superZ,

        side:
            side,

        seedHash:
            modfusionReserveHashString(
                baseSeedText
            ),

        homeCount:
            homes.length,

        reserveCount:
            reserves.length,

        pairCount:
            pairs.length,

        pairs:
            pairs,

        homeMap:
            homeMap,

        reserveMap:
            reserveMap,

        unpairedHomes:
            unpairedHomes,

        unpairedReserves:
            unpairedReserves
    }
}


/*
 * =========================================================
 * Lookup pair by Home Region
 * =========================================================
 */

function getModfusionReservePairForHome(
    level,
    regionX,
    regionZ
)
{
    regionX =
        Math.floor(
            Number(regionX)
        )


    regionZ =
        Math.floor(
            Number(regionZ)
        )


    /*
     * Determine Super Region.
     */

    var superInfo =
        global.ModfusionBuildingDistributor
            .getSuperRegion(
                regionX,
                regionZ
            )


    if(superInfo == null)
    {
        return null
    }


    var plan =
        getModfusionReservePairingPlan(
            level,
            superInfo.superX,
            superInfo.superZ
        )


    if(
        plan == null ||
        plan.status !== "OK"
    )
    {
        return null
    }


    return plan.homeMap[
        getModfusionReserveRegionKey(
            regionX,
            regionZ
        )
    ]
}


/*
 * =========================================================
 * Lookup owner of a Reserve Region
 * =========================================================
 */

function getModfusionReserveOwner(
    level,
    regionX,
    regionZ
)
{
    regionX =
        Math.floor(
            Number(regionX)
        )


    regionZ =
        Math.floor(
            Number(regionZ)
        )


    var superInfo =
        global.ModfusionBuildingDistributor
            .getSuperRegion(
                regionX,
                regionZ
            )


    if(superInfo == null)
    {
        return null
    }


    var plan =
        getModfusionReservePairingPlan(
            level,
            superInfo.superX,
            superInfo.superZ
        )


    if(
        plan == null ||
        plan.status !== "OK"
    )
    {
        return null
    }


    return plan.reserveMap[
        getModfusionReserveRegionKey(
            regionX,
            regionZ
        )
    ]
}


/*
 * =========================================================
 * Resolve one Home Slot
 * =========================================================
 *
 * 最多：
 *
 * Search #1
 * Home
 *
 * Search #2
 * Paired Reserve
 *
 *
 * 不搜索其他 Slot。
 * 不搜索其他 Reserve。
 */

function resolveModfusionBuildingHomeSlot(
    level,
    regionX,
    regionZ
)
{
    /*
     * =====================================================
     * Dependencies
     * =====================================================
     */

    if(level == null)
    {
        return {

            status:
                "ERROR",

            reason:
                "LEVEL_IS_NULL"
        }
    }


    if(
        global.ModfusionBuildingDistributor ==
        null
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "DISTRIBUTOR_NOT_LOADED"
        }
    }


    if(
        global.ModfusionBuildingCandidateSearch ==
        null
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "CANDIDATE_SEARCH_NOT_LOADED"
        }
    }


    if(
        global.ModfusionBuildingCandidateSearch
            .searchBuildingInRegion ==
        null
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "B3_2_CANDIDATE_API_NOT_LOADED"
        }
    }


    /*
     * =====================================================
     * Normalize
     * =====================================================
     */

    regionX =
        Math.floor(
            Number(regionX)
        )


    regionZ =
        Math.floor(
            Number(regionZ)
        )


    /*
     * =====================================================
     * Must be a Home Region
     * =====================================================
     */

    var assignment =
        global.ModfusionBuildingDistributor
            .getAssignmentForRegion(
                level,
                regionX,
                regionZ
            )


    if(
        assignment == null ||
        assignment.status !== "OK"
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "HOME_ASSIGNMENT_FAILED"
        }
    }


    if(!assignment.active)
    {
        return {

            status:
                "OK",

            outcome:
                "RESERVE_REGION",

            regionX:
                regionX,

            regionZ:
                regionZ,

            buildingId:
                null
        }
    }


    var buildingId =
        String(
            assignment.buildingId
        )


    /*
     * =====================================================
     * Pairing
     * =====================================================
     */

    var pair =
        getModfusionReservePairForHome(
            level,
            regionX,
            regionZ
        )


    if(pair == null)
    {
        return {

            status:
                "ERROR",

            reason:
                "HOME_PAIR_NOT_FOUND",

            regionX:
                regionX,

            regionZ:
                regionZ,

            buildingId:
                buildingId
        }
    }


    /*
     * =====================================================
     * Search Home
     * =====================================================
     */

    var homeSearch =
        global.ModfusionBuildingCandidateSearch
            .searchBuildingInRegion(
                level,
                regionX,
                regionZ,
                buildingId
            )


    if(
        homeSearch == null ||
        homeSearch.status !== "OK"
    )
    {
        return {

            status:
                "ERROR",

            reason:
                (
                    homeSearch != null &&
                    homeSearch.reason != null
                )
                ? homeSearch.reason
                : "HOME_SEARCH_ERROR"
        }
    }


    /*
     * =====================================================
     * Home success
     * =====================================================
     */

    if(
        homeSearch.outcome ===
        "VALID_SITE_FOUND"
    )
    {
        return {

            status:
                "OK",

            outcome:
                "HOME_SITE_FOUND",

            version:
                MODFUSION_RESERVE_VERSION,

            buildingId:
                buildingId,

            homeRegionX:
                regionX,

            homeRegionZ:
                regionZ,

            reserveRegionX:
                (
                    pair.reserve != null
                    ? pair.reserve.regionX
                    : null
                ),

            reserveRegionZ:
                (
                    pair.reserve != null
                    ? pair.reserve.regionZ
                    : null
                ),

            usedReserve:
                false,

            finalRegionX:
                regionX,

            finalRegionZ:
                regionZ,

            selected:
                homeSearch.selected,

            homeSearch:
                homeSearch,

            reserveSearch:
                null
        }
    }


    /*
     * =====================================================
     * No paired Reserve
     * =====================================================
     */

    if(pair.reserve == null)
    {
        return {

            status:
                "OK",

            outcome:
                "UNRESOLVED",

            version:
                MODFUSION_RESERVE_VERSION,

            reason:
                "HOME_FAILED_NO_RESERVE",

            buildingId:
                buildingId,

            homeRegionX:
                regionX,

            homeRegionZ:
                regionZ,

            reserveRegionX:
                null,

            reserveRegionZ:
                null,

            usedReserve:
                false,

            finalRegionX:
                null,

            finalRegionZ:
                null,

            selected:
                null,

            homeSearch:
                homeSearch,

            reserveSearch:
                null
        }
    }


    /*
     * =====================================================
     * Home failed → Search paired Reserve
     * =====================================================
     */

    var reserveSearch =
        global.ModfusionBuildingCandidateSearch
            .searchBuildingInRegion(
                level,
                pair.reserve.regionX,
                pair.reserve.regionZ,
                buildingId
            )


    if(
        reserveSearch == null ||
        reserveSearch.status !== "OK"
    )
    {
        return {

            status:
                "ERROR",

            reason:
                (
                    reserveSearch != null &&
                    reserveSearch.reason != null
                )
                ? reserveSearch.reason
                : "RESERVE_SEARCH_ERROR"
        }
    }


    /*
     * =====================================================
     * Reserve success
     * =====================================================
     */

    if(
        reserveSearch.outcome ===
        "VALID_SITE_FOUND"
    )
    {
        return {

            status:
                "OK",

            outcome:
                "RESERVE_SITE_FOUND",

            version:
                MODFUSION_RESERVE_VERSION,

            buildingId:
                buildingId,

            homeRegionX:
                regionX,

            homeRegionZ:
                regionZ,

            reserveRegionX:
                pair.reserve.regionX,

            reserveRegionZ:
                pair.reserve.regionZ,

            usedReserve:
                true,

            finalRegionX:
                pair.reserve.regionX,

            finalRegionZ:
                pair.reserve.regionZ,

            selected:
                reserveSearch.selected,

            homeSearch:
                homeSearch,

            reserveSearch:
                reserveSearch
        }
    }


    /*
     * =====================================================
     * Both failed
     * =====================================================
     */

    return {

        status:
            "OK",

        outcome:
            "UNRESOLVED",

        version:
            MODFUSION_RESERVE_VERSION,

        reason:
            "HOME_AND_RESERVE_FAILED",

        buildingId:
            buildingId,

        homeRegionX:
            regionX,

        homeRegionZ:
            regionZ,

        reserveRegionX:
            pair.reserve.regionX,

        reserveRegionZ:
            pair.reserve.regionZ,

        usedReserve:
            false,

        finalRegionX:
            null,

        finalRegionZ:
            null,

        selected:
            null,

        homeSearch:
            homeSearch,

        reserveSearch:
            reserveSearch
    }
}


/*
 * =========================================================
 * Resolve from Block coordinate
 * =========================================================
 */

function resolveModfusionBuildingBlock(
    level,
    blockX,
    blockZ
)
{
    if(
        global.ModfusionBuildingDistributor ==
        null
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "DISTRIBUTOR_NOT_LOADED"
        }
    }


    var assignment =
        global.ModfusionBuildingDistributor
            .getAssignmentForBlock(
                level,
                blockX,
                blockZ
            )


    if(
        assignment == null ||
        assignment.status !== "OK"
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "BLOCK_ASSIGNMENT_FAILED"
        }
    }


    /*
     * =====================================================
     * Current physical Region is Reserve
     * =====================================================
     *
     * Do NOT independently generate something here.
     *
     * It belongs to a specific Home Slot.
     */

    if(!assignment.active)
    {
        var owner =
            getModfusionReserveOwner(
                level,
                assignment.regionX,
                assignment.regionZ
            )


        return {

            status:
                "OK",

            outcome:
                "RESERVE_REGION",

            regionX:
                assignment.regionX,

            regionZ:
                assignment.regionZ,

            owner:
                owner
        }
    }


    return resolveModfusionBuildingHomeSlot(
        level,
        assignment.regionX,
        assignment.regionZ
    )
}


/*
 * =========================================================
 * Messages
 * =========================================================
 */

function modfusionReserveMessage(
    player,
    message
)
{
    console.log(
        "[ModFusion Reserve Fallback] " +
        message
    )


    if(player != null)
    {
        player.tell(
            "[ModFusion Reserve Fallback] " +
            message
        )
    }
}


/*
 * =========================================================
 * Pairing plan report
 * =========================================================
 */

function printModfusionReservePairingPlan(
    player,
    plan
)
{
    modfusionReserveMessage(
        player,
        "Reserve pairing:"
    )


    var i


    for(
        i = 0;
        i < plan.pairs.length;
        i++
    )
    {
        var pair =
            plan.pairs[i]


        modfusionReserveMessage(
            player,
            "#" +
            (i + 1) +
            " " +
            pair.buildingId +
            " | HOME " +
            pair.home.regionX +
            "," +
            pair.home.regionZ +
            " -> RESERVE " +
            pair.reserve.regionX +
            "," +
            pair.reserve.regionZ
        )
    }
}


/*
 * =========================================================
 * Result report
 * =========================================================
 */

function printModfusionReserveResult(
    player,
    level,
    report
)
{
    if(report == null)
    {
        modfusionReserveMessage(
            player,
            "ERROR: report is null."
        )

        return
    }


    if(report.status !== "OK")
    {
        modfusionReserveMessage(
            player,
            "ERROR: " +
            report.reason
        )

        return
    }


    modfusionReserveMessage(
        player,
        "================================"
    )


    /*
     * =====================================================
     * Current Region is Reserve
     * =====================================================
     */

    if(
        report.outcome ===
        "RESERVE_REGION"
    )
    {
        modfusionReserveMessage(
            player,
            "Current Region: " +
            report.regionX +
            " " +
            report.regionZ
        )


        modfusionReserveMessage(
            player,
            "Type: RESERVE"
        )


        if(report.owner != null)
        {
            modfusionReserveMessage(
                player,
                "Reserved for: " +
                report.owner.buildingId
            )


            modfusionReserveMessage(
                player,
                "Owner Home Region: " +
                report.owner.home.regionX +
                " " +
                report.owner.home.regionZ
            )
        }
        else
        {
            modfusionReserveMessage(
                player,
                "Owner: NONE"
            )
        }


        modfusionReserveMessage(
            player,
            "No independent search performed."
        )


        modfusionReserveMessage(
            player,
            "================================"
        )


        return
    }


    /*
     * =====================================================
     * Header
     * =====================================================
     */

    modfusionReserveMessage(
        player,
        "Building: " +
        report.buildingId
    )


    modfusionReserveMessage(
        player,
        "Home Region: " +
        report.homeRegionX +
        " " +
        report.homeRegionZ
    )


    modfusionReserveMessage(
        player,
        "Paired Reserve: " +
        report.reserveRegionX +
        " " +
        report.reserveRegionZ
    )


    modfusionReserveMessage(
        player,
        "--------------------------------"
    )


    /*
     * =====================================================
     * Home result
     * =====================================================
     */

    if(report.homeSearch != null)
    {
        modfusionReserveMessage(
            player,
            "Home search: " +
            report.homeSearch.outcome
        )
    }


    /*
     * =====================================================
     * Reserve result
     * =====================================================
     */

    if(report.reserveSearch != null)
    {
        modfusionReserveMessage(
            player,
            "Reserve search: " +
            report.reserveSearch.outcome
        )
    }
    else
    {
        modfusionReserveMessage(
            player,
            "Reserve search: NOT_NEEDED"
        )
    }


    modfusionReserveMessage(
        player,
        "--------------------------------"
    )


    /*
     * =====================================================
     * Final
     * =====================================================
     */

    if(
        report.outcome ===
        "HOME_SITE_FOUND"
    )
    {
        modfusionReserveMessage(
            player,
            "Result: HOME_SITE_FOUND"
        )


        modfusionReserveMessage(
            player,
            "Reserve preserved."
        )
    }
    else if(
        report.outcome ===
        "RESERVE_SITE_FOUND"
    )
    {
        modfusionReserveMessage(
            player,
            "Result: RESERVE_SITE_FOUND"
        )


        modfusionReserveMessage(
            player,
            "Fallback used: YES"
        )
    }
    else
    {
        modfusionReserveMessage(
            player,
            "Result: UNRESOLVED"
        )


        modfusionReserveMessage(
            player,
            "Reason: " +
            report.reason
        )
    }


    if(report.selected != null)
    {
        modfusionReserveMessage(
            player,
            "Final Region: " +
            report.finalRegionX +
            " " +
            report.finalRegionZ
        )


        modfusionReserveMessage(
            player,
            "Selected position: " +
            report.selected.x +
            " " +
            report.selected.y +
            " " +
            report.selected.z
        )


        modfusionReserveMessage(
            player,
            "Selected layer: " +
            report.selected.layer
        )


        modfusionReserveMessage(
            player,
            "Selected biome: " +
            report.selected.biome
        )


        if(report.selected.analyzer != null)
        {
            modfusionReserveMessage(
                player,
                "Biome coverage: " +
                (
                    Math.round(
                        report.selected
                            .analyzer
                            .biomeCoverage *
                        1000
                    ) /
                    10
                ) +
                "%"
            )


            modfusionReserveMessage(
                player,
                "Foundation: " +
                report.selected
                    .analyzer
                    .foundationStablePoints +
                "/" +
                report.selected
                    .analyzer
                    .foundationTotalPoints
            )
        }
    }


    /*
     * =====================================================
     * Pairing plan for this Super Region
     * =====================================================
     */

    var superInfo =
        global.ModfusionBuildingDistributor
            .getSuperRegion(
                report.homeRegionX,
                report.homeRegionZ
            )


    if(superInfo != null)
    {
        var pairingPlan =
            getModfusionReservePairingPlan(
                level,
                superInfo.superX,
                superInfo.superZ
            )


        if(
            pairingPlan != null &&
            pairingPlan.status === "OK"
        )
        {
            modfusionReserveMessage(
                player,
                "--------------------------------"
            )


            modfusionReserveMessage(
                player,
                "Super Region: " +
                pairingPlan.superX +
                " " +
                pairingPlan.superZ
            )


            modfusionReserveMessage(
                player,
                "Homes: " +
                pairingPlan.homeCount
            )


            modfusionReserveMessage(
                player,
                "Reserves: " +
                pairingPlan.reserveCount
            )


            modfusionReserveMessage(
                player,
                "Pairs: " +
                pairingPlan.pairCount
            )


            printModfusionReservePairingPlan(
                player,
                pairingPlan
            )
        }
    }


    modfusionReserveMessage(
        player,
        "================================"
    )
}


/*
 * =========================================================
 * Public API
 * =========================================================
 */

global.ModfusionBuildingReserveFallback = {

    getPairingPlan:
        getModfusionReservePairingPlan,

    getPairForHome:
        getModfusionReservePairForHome,

    getReserveOwner:
        getModfusionReserveOwner,

    resolveHome:
        resolveModfusionBuildingHomeSlot,

    resolveBlock:
        resolveModfusionBuildingBlock,

    print:
        printModfusionReserveResult
}


/*
 * =========================================================
 * Test command
 * =========================================================
 *
 * /kubejs custom_command modfusion_reserve_fallback
 *
 *
 * HOME Region:
 *
 * Home B3.1
 *      ↓
 * success
 *      OR
 * paired Reserve B3.1
 *
 *
 * RESERVE Region:
 *
 * 只显示它属于哪个 Home Slot。
 * 不主动搜索。
 *
 *
 * Still:
 *
 * 不 place structure
 * 不写 persistentData
 * 不做 spacing
 */

ServerEvents.customCommand(
    "modfusion_reserve_fallback",
    function(event)
    {
        var player =
            event.player


        if(player == null)
        {
            console.log(
                "[ModFusion Reserve Fallback] Command must be run by a player."
            )

            return
        }


        var report =
            resolveModfusionBuildingBlock(
                player.level,

                Math.floor(
                    player.x
                ),

                Math.floor(
                    player.z
                )
            )


        printModfusionReserveResult(
            player,
            player.level,
            report
        )
    }
)


console.log(
    "[ModFusion Reserve Fallback] Ready."
)