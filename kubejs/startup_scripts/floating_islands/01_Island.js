// 岛屿数据对象

console.log(
"[ModFusion] Loading Island class"
)



global.Island=function(data){


this.x=data.x

this.y=data.y

this.z=data.z


this.radius=data.radius

this.height=data.height


this.biome=data.biome || "plains"

this.building=data.building || null



}



// 判断两个岛是否重叠

global.Island.prototype.isOverlap=function(other){


var dx=this.x-other.x

var dz=this.z-other.z


var distance=
Math.sqrt(
dx*dx+dz*dz
)



return distance <
(
this.radius+
other.radius+
global.FusionConfig.collisionPadding
)



}



console.log(
"[ModFusion] Island class loaded"
)