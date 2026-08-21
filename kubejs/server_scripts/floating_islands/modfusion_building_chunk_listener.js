/*
 * ModFusion建筑区块加载监听器
 *
 * 这个文件必须放在startup_scripts中。
 * 修改后需要完整退出游戏并重新启动，/reload不会重新注册Forge事件。
 */

ForgeEvents.onEvent(
    "net.minecraftforge.event.level.ChunkEvent$Load",
    function(event)
    {
        var level = event.getLevel()

        if(level == null || level.isClientSide())
        {
            return
        }

        if(
            String(level.dimension) !==
            "mahou:modfusion_dimension"
        )
        {
            return
        }

        var server = level.getServer()

        if(server == null)
        {
            return
        }

        var chunkPosition = event.getChunk().getPos()
        var chunkX = Number(chunkPosition.x)
        var chunkZ = Number(chunkPosition.z)

        /*
         * 区块加载可能不在服务器主线程完成。
         * 把建筑队列操作转交给服务器线程。
         */
        server.execute(function()
        {
            var controller =
                global.ModfusionBuildingController

            if(
                controller != null &&
                typeof controller.onChunkLoaded === "function"
            )
            {
                controller.onChunkLoaded(
                    server,
                    chunkX,
                    chunkZ
                )
            }
        })
    }
)