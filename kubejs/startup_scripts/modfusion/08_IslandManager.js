// 负责岛屿数量、随机位置、防碰撞

console.log(
"[ModFusion] Loading IslandManager"
)


global.IslandManager={

generated:false,
islands:[],


generate:function(level){


if(this.generated)
{

console.log(
"[ModFusion] Islands already generated"
)

return

}



this.generated=true


console.log(
"[ModFusion] IslandManager.generate()"
)



var island =
this.createIsland()



this.islands.push(
island
)



console.log(
"Island:",
island.x,
island.y,
island.z,
island.radius
)



global.IslandBlockGenerator.generate(
level,
island
)



},




createIsland:function(){



return {


x:
0,


y:
160,


z:
0,


radius:
40,


height:
20



}



}



}



console.log(
"[ModFusion] IslandManager loaded"
)