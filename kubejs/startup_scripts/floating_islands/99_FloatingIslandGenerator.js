// 负责启动

global.FloatingIslandGenerator={


init:function(level){


console.log(
"============================"
)

console.log(
"FloatingIslandGenerator RUN"
)


console.log(
"Dimension:",
String(level.dimension)
)



console.log(
"IslandManager:",
global.IslandManager
)



// 添加这一段
if(
global.IslandManager
)
{

console.log(
"[ModFusion] Calling IslandManager.generate()"
)


global.IslandManager.generate(level)


}
else
{

console.log(
"[ModFusion] IslandManager missing!"
)

}



console.log(
"============================"
)


}


}