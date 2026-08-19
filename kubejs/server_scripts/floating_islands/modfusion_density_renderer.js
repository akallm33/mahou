// 直接采样当前世界种子初始化后的密度函数。
// 不会加载区块、生成建筑或写入区块存档。

var MF_RENDER_ResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation')
var MF_RENDER_FileUtils = Java.loadClass(
  'org.apache.commons.io.FileUtils'
)
var MF_RENDER_DIMENSION =
  'mahou:modfusion_dimension'

// 中层岛屿最宽处的Y坐标
var MF_RENDER_DEFAULT_Y = 64

// 每tick计算的像素数
var MF_RENDER_PIXELS_PER_TICK = 8192

// 防止生成过大的PNG
var MF_RENDER_MAX_IMAGE_SIDE = 4096


var MF_RENDER_IntegerArgumentType =
  Java.loadClass(
    'com.mojang.brigadier.arguments.IntegerArgumentType'
  )

var MF_RENDER_SinglePointContext =
  Java.loadClass(
    'net.minecraft.world.level.levelgen.DensityFunction$SinglePointContext'
  )

var MF_RENDER_NativeImage =
  Java.loadClass(
    'com.mojang.blaze3d.platform.NativeImage'
  )

var MF_RENDER_LevelResource = 
  Java.loadClass(
    'net.minecraft.world.level.storage.LevelResource'
  )

var MF_RENDER_BitSet =
  Java.loadClass(
    'java.util.BitSet'
  )


if (!global.ModfusionDensityRenderer) {
  global.ModfusionDensityRenderer = {
    job: null
  }
}


function mfRenderTell(
  player,
  message
) {
  player.tell(
    Component.of(message)
  )
}


function mfRenderGetPlayer(context) {
  try {
    return context
      .getSource()
      .getPlayerOrException()
  } catch (error) {
    context
      .getSource()
      .sendFailure(
        Component.of(
          '该命令只能由玩家执行。'
        )
      )

    return null
  }
}


// ============================================================
// 创建渲染任务
// ============================================================

function mfRenderCreateJob(context, radius, scale, sampleY) {
  var player = mfRenderGetPlayer(context)
  if (!player) return 0

  // 用于记录执行到了哪一步。
  // 如果后面报错，聊天栏和日志都会显示具体阶段。
  var stage = '检查任务状态'

  // 如果创建 NativeImage 后发生错误，需要主动释放内存。

  try {
    stage = '检查任务状态'

    if (global.ModfusionDensityRenderer.job) {
      mfRenderTell(
        player,
        '§c[Density Render] 已经有一个渲染任务。请先使用 /modfusion_render cancel。'
      )
      return 0
    }

    /*
     * MinecraftServer.getLevel() 需要 ResourceKey<Level>，
     * 不能直接传入 "mahou:modfusion_dimension" 字符串。
     */
    stage = '构造维度键'

    var dimensionLocation =
      MF_RENDER_ResourceLocation.tryParse(MF_RENDER_DIMENSION)

    if (!dimensionLocation) {
      mfRenderTell(
        player,
        '§c[Density Render] 非法维度ID：' + MF_RENDER_DIMENSION
      )
      return 0
    }

stage = '取得维度实例'

// 精确传入 ResourceLocation，调用 KubeJS 提供的维度获取方法。
// 这样不会再与原版 getLevel(ResourceKey) 产生重载歧义。
var level = player.getServer().getLevel(dimensionLocation)

    if (!level) {
      mfRenderTell(
        player,
        '§c[Density Render] 找不到维度 ' + MF_RENDER_DIMENSION
      )
      return 0
    }

    /*
     * 根据半径和每像素代表的方块数计算图片尺寸。
     *
     * 例如：
     * radius = 5000
     * scale = 4
     *
     * 图片宽度：
     * 5000 × 2 ÷ 4 + 1 = 2501
     */
    stage = '计算图像尺寸'

    var width = Math.floor(radius * 2 / scale) + 1
    var height = width

    if (width > MF_RENDER_MAX_IMAGE_SIDE) {
      var minimumScale = Math.ceil(
        radius * 2 / (MF_RENDER_MAX_IMAGE_SIDE - 1)
      )

      mfRenderTell(
        player,
        '§c[Density Render] 图像尺寸将达到 ' +
          width +
          '×' +
          height +
          '，超过上限。'
      )

      mfRenderTell(
        player,
        '§e请把 blocksPerPixel 至少提高到 ' + minimumScale + '。'
      )

      return 0
    }

    /*
     * 获取这个存档已经根据世界种子初始化完成的最终密度函数。
     * 这里不会创建或加载区块。
     */
    stage = '取得已初始化的密度函数'

    var chunkSource = level.getChunkSource()
    var randomState = chunkSource.randomState()
    var density = randomState.router().finalDensity()

    /*
     * 创建图片和实体像素记录。
     */
    stage = '创建像素记录缓冲区'

    var occupied = new MF_RENDER_BitSet(width * height)

    /*
     * 创建任务，后续由 PlayerEvents.tick 分批计算。
     */
    stage = '建立渲染任务'

    global.ModfusionDensityRenderer.job = {
      ownerEntityId: player.getId(),

      density: density,
      occupied: occupied,

      radius: radius,
      radiusSquared: radius * radius,

      scale: scale,
      sampleY: sampleY,

      width: width,
      height: height,

      pixelIndex: 0,
      solidPixels: 0,

      startedAt: Date.now()
    }

    /*
     * 图片已经交给全局任务管理。
     * 将局部变量清空，避免 catch 意外关闭正在使用的图片。
     */

    mfRenderTell(
      player,
      '§b[Density Render] 开始直接采样地形密度。'
    )

    mfRenderTell(
      player,
      '§7范围：±' +
        radius +
        ' 方块；分辨率：1像素=' +
        scale +
        '方块；采样Y=' +
        sampleY
    )

    mfRenderTell(
      player,
      '§7图像尺寸：' +
        width +
        '×' +
        height +
        '；不会加载或生成区块。'
    )

    return 1
  } catch (error) {
    /*
     * 如果 NativeImage 已经创建，但任务还没有成功建立，
     * 必须关闭图片以释放本地内存。
     */

    var detail = String(error)

    /*
     * 将具体失败阶段显示在游戏聊天栏。
     */
    mfRenderTell(
      player,
      '§c[Density Render] 启动失败，阶段：' + stage
    )

    mfRenderTell(
      player,
      '§c' + detail
    )

    /*
     * 同时把完整信息写入 KubeJS 日志。
     */
    console.error(
      '[Density Render] Start failed at stage "' +
        stage +
        '": ' +
        detail
    )

    if (error && error.stack) {
      console.error(String(error.stack))
    }

    return 0
  }
}


// ============================================================
// 显示进度
// ============================================================

function mfRenderProgress(player) {
  var job =
    global.ModfusionDensityRenderer.job


  if (!job) {
    mfRenderTell(
      player,
      '§e[Density Render] 当前没有渲染任务。'
    )

    return 0
  }


  var total =
    job.width *
    job.height

  var percent =
    Math.floor(
      job.pixelIndex *
      1000 /
      total
    ) / 10


  mfRenderTell(
    player,
    '§b[Density Render] ' +
    job.pixelIndex +
    '/' +
    total +
    '（' +
    percent +
    '%）'
  )

  return 1
}


// ============================================================
// 写出PNG
// ============================================================

function mfRenderWriteImages(player, job) {
  var baseName =
    'modfusion_r' +
    job.radius +
    '_s' +
    job.scale +
    '_y' +
    job.sampleY

  var saveDirectory = player
    .getServer()
    .getWorldPath(MF_RENDER_LevelResource.ROOT)

  /*
   * 明确指定 resolve(String)，避免 Rhino 将 ConsString
   * 同时匹配到 resolve(Path) 和 resolve(String)。
   */
  var filledPath =
    saveDirectory['resolve(java.lang.String)'](
      baseName + '_filled.png'
    )

  var outlinePath =
    saveDirectory['resolve(java.lang.String)'](
      baseName + '_outline.png'
    )

  var filledImage = null
  var outlineImage = null

  try {
    /*
     * 图片仅在最终写入阶段创建，
     * 不再让 NativeImage 存活于整个密度采样过程。
     */
    filledImage = new MF_RENDER_NativeImage(
      job.width,
      job.height,
      true
    )

    outlineImage = new MF_RENDER_NativeImage(
      job.width,
      job.height,
      true
    )

    /*
     * 根据 BitSet 同时绘制填充图和轮廓图。
     */
    for (var z = 0; z < job.height; z++) {
      for (var x = 0; x < job.width; x++) {
        var index = z * job.width + x

        if (!job.occupied.get(index)) {
          continue
        }

        // ABGR 格式，对应 RGB #79B86A。
        filledImage.setPixelRGBA(
          x,
          z,
          -9783175
        )

        /*
         * 四方向中有一个不是实体像素，
         * 当前像素就属于岛屿轮廓。
         */
        var edge =
          x === 0 ||
          z === 0 ||
          x === job.width - 1 ||
          z === job.height - 1

        if (
          !edge &&
          !job.occupied.get(index - 1)
        ) {
          edge = true
        }

        if (
          !edge &&
          !job.occupied.get(index + 1)
        ) {
          edge = true
        }

        if (
          !edge &&
          !job.occupied.get(
            index - job.width
          )
        ) {
          edge = true
        }

        if (
          !edge &&
          !job.occupied.get(
            index + job.width
          )
        ) {
          edge = true
        }

        if (edge) {
          outlineImage.setPixelRGBA(
            x,
            z,
            -1
          )
        }
      }
    }

    /*
     * 在两张图中标出世界坐标 X=0、Z=0。
     */
    var originX = Math.round(
      job.radius / job.scale
    )

    var originZ = originX

    for (
      var marker = -3;
      marker <= 3;
      marker++
    ) {
      var mx = originX + marker
      var mz = originZ + marker

      if (
        mx >= 0 &&
        mx < job.width
      ) {
        filledImage.setPixelRGBA(
          mx,
          originZ,
          -16776961
        )

        outlineImage.setPixelRGBA(
          mx,
          originZ,
          -16776961
        )
      }

      if (
        mz >= 0 &&
        mz < job.height
      ) {
        filledImage.setPixelRGBA(
          originX,
          mz,
          -16776961
        )

        outlineImage.setPixelRGBA(
          originX,
          mz,
          -16776961
        )
      }
    }

    /*
     * NativeImage 同时有 File 和 Path 两个写入重载，
     * 因此明确选择 Path 版本。
     */
MF_RENDER_FileUtils.writeByteArrayToFile(
  filledPath.toFile(),
  filledImage.asByteArray()
)

MF_RENDER_FileUtils.writeByteArrayToFile(
  outlinePath.toFile(),
  outlineImage.asByteArray()
)
  } finally {
    if (filledImage) {
      filledImage.close()
    }

    if (outlineImage) {
      outlineImage.close()
    }
  }

  var elapsedSeconds =
    Math.round(
      (Date.now() - job.startedAt) / 100
    ) / 10

  mfRenderTell(
    player,
    '§a[Density Render] 渲染完成，用时 ' +
      elapsedSeconds +
      ' 秒。'
  )

  mfRenderTell(
    player,
    '§7实体像素数：' +
      job.solidPixels
  )

  mfRenderTell(
    player,
    '§7填充图：' +
      filledPath.toAbsolutePath()
  )

  mfRenderTell(
    player,
    '§7轮廓图：' +
      outlinePath.toAbsolutePath()
  )
}


// ============================================================
// 注册命令
// ============================================================

ServerEvents.commandRegistry(
  function (event) {
    var Commands =
      event.commands


    var radiusArgument =
      Commands
        .argument(
          'radius',

          MF_RENDER_IntegerArgumentType
            .integer(
              64,
              100000
            )
        )

        .then(
          Commands
            .argument(
              'blocksPerPixel',

              MF_RENDER_IntegerArgumentType
                .integer(
                  1,
                  1024
                )
            )

            .executes(
              function (context) {
                return mfRenderCreateJob(
                  context,

                  MF_RENDER_IntegerArgumentType
                    .getInteger(
                      context,
                      'radius'
                    ),

                  MF_RENDER_IntegerArgumentType
                    .getInteger(
                      context,
                      'blocksPerPixel'
                    ),

                  MF_RENDER_DEFAULT_Y
                )
              }
            )

            .then(
              Commands
                .argument(
                  'sampleY',

                  MF_RENDER_IntegerArgumentType
                    .integer(
                      -64,
                      319
                    )
                )

                .executes(
                  function (context) {
                    return mfRenderCreateJob(
                      context,

                      MF_RENDER_IntegerArgumentType
                        .getInteger(
                          context,
                          'radius'
                        ),

                      MF_RENDER_IntegerArgumentType
                        .getInteger(
                          context,
                          'blocksPerPixel'
                        ),

                      MF_RENDER_IntegerArgumentType
                        .getInteger(
                          context,
                          'sampleY'
                        )
                    )
                  }
                )
            )
        )


    event.register(
      Commands
        .literal(
          'modfusion_render'
        )

        .requires(
          function (source) {
            return source
              .hasPermission(2)
          }
        )

        .then(
          Commands
            .literal('start')
            .then(
              radiusArgument
            )
        )

        .then(
          Commands
            .literal('status')

            .executes(
              function (context) {
                var player =
                  mfRenderGetPlayer(
                    context
                  )

                return player
                  ? mfRenderProgress(
                      player
                    )
                  : 0
              }
            )
        )

        .then(
          Commands
            .literal('cancel')

            .executes(
              function (context) {
                var player =
                  mfRenderGetPlayer(
                    context
                  )

                if (!player) {
                  return 0
                }


                if (
                  !global
                    .ModfusionDensityRenderer
                    .job
                ) {
                  mfRenderTell(
                    player,
                    '§e[Density Render] 当前没有渲染任务。'
                  )

                  return 0
                }


                global
                  .ModfusionDensityRenderer
                  .job = null


                mfRenderTell(
                  player,
                  '§e[Density Render] 渲染任务已取消。'
                )

                return 1
              }
            )
        )
    )
  }
)


// ============================================================
// 分批计算密度，避免一次性卡住服务器
// ============================================================

PlayerEvents.tick(function (event) {
  var player = event.player

  if (player.level.isClientSide()) return

  var job = global.ModfusionDensityRenderer.job

  if (!job || player.getId() !== job.ownerEntityId) return

  var total = job.width * job.height
  var end = Math.min(
    job.pixelIndex + MF_RENDER_PIXELS_PER_TICK,
    total
  )


    while (
      job.pixelIndex < end
    ) {
      var index =
        job.pixelIndex


      var px =
        index %
        job.width


      var pz =
        Math.floor(
          index /
          job.width
        )


      var worldX =
        -job.radius +
        px *
        job.scale


      var worldZ =
        -job.radius +
        pz *
        job.scale


      // 只绘制半径范围内的圆形区域
      if (
        worldX *
        worldX +
        worldZ *
        worldZ
        <=
        job.radiusSquared
      ) {
        var pointContext =
          new MF_RENDER_SinglePointContext(
            worldX,
            job.sampleY,
            worldZ
          )


        var densityValue =
          job.density.compute(
            pointContext
          )


        // final_density > 0 表示地形实体
        if (
          densityValue > 0.0
        ) {
          job.occupied.set(
            index
          )
          job.solidPixels++
        }
      }


      job.pixelIndex++
    }


    if (
      job.pixelIndex >= total
    ) {
      global.ModfusionDensityRenderer.job = null

      try {
        mfRenderWriteImages(
          player,
          job
        )
      } catch (error) {
        mfRenderTell(
          player,
          '§c[Density Render] 写入PNG失败：' +
          error
        )


        console.error(
          '[Density Render] ' +
          error
        )
      }
    }
  }
)