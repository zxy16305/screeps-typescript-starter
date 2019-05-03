const _ = require('lodash')
var roleUpgrader = require('roles.upgrader');
var i = 4;
var maxCreep = 9;
var worksNumber = 3;

function getRange(position, range = 5) {
  var minX = position.x - range < 0 ? 0 : position.x - range;
  var maxX = position.x + range > 48 ? 48 : position.x + range;
  var minY = position.y - range < 0 ? 0 : position.y - range;
  var maxY = position.y + range > 48 ? 48 : position.y + range;
  var pos = []
  for (var x = minX; x < maxX; x++) {
    for (var y = minY; y < maxY; y++) {
      pos.push(new RoomPosition(x, y, position.roomName))
    }
  }
  return pos
}

function getRange2(position) {
  return [[43, 28], [44, 28], [45, 27], [45, 26], [42, 29], [42, 28], [44, 27], [45, 24], [45, 25], [45, 23], [45, 22], [38, 26], [39, 24], [38, 23], [37, 22], [36, 22], [45, 21]].map(it => new RoomPosition(it[0], it[1], position.roomName))
}

function getEnsureRoad(room) {
  return [[39, 21], [40, 21], [41, 21], [40, 22], [40, 23], [40, 24], [40, 25], [40, 26], [40, 27], [40, 28], [41, 28], [39, 29], [38, 28], [37, 28], [38, 27], [39, 27], [42, 27], [43, 27], [44, 26], [44, 25], [44, 24], [44, 23], [39, 26]]
    .concat([[16, 23], [17, 25], [18, 26], [19, 27], [20, 28], [20, 29], [20, 30], [20, 31], [20, 32], [20, 33], [20, 34], [20, 35], [21, 36], [22, 37], [23, 38], [24, 39]])
    .concat([[13, 43], [14, 43], [15, 44], [16, 45], [17, 46], [18, 46], [19, 46], [20, 46], [21, 46], [22, 46], [23, 46]]).map(it => room.getPositionAt(it[0], it[1]))
}

function prefectWorkerGenerate(energy) {
  var gole = energy > 800 ? 800 : energy;
  var temp = gole
  var simple = [MOVE, WORK, CARRY]
  var index = 0;
  var array = []
  while (temp > 0 && array.length <= 50) {
    var body = simple[index++]
    array.push(body)
    index = index % 3
    temp = temp - BODYPART_COST[body]
  }
  if (temp < 0) array.pop()
  console.log(`generate - ${gole} - ${array}`)
  return array;
}

function isFull(room) {
  var target = room.find(FIND_STRUCTURES, {
    filter: (structure) => {
      return (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN) &&
        structure.energy < structure.energyCapacity;
    }
  });
  return target.length == 0;
}


function getAllEnergy(room) {
  return room.find(FIND_STRUCTURES, {
    filter: (structure) => {
      return (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN)
    }
  }).map(it => it.energy).reduce((a, b) => a + b);
}

function clearCreep(creepObj) {
  try {
    var names = Object.keys(creepObj).map(it => creepObj[it].name)
    // console.log(names)
    Object.keys(Memory.creeps).forEach(it => {
      if (names.indexOf(it) == -1) {
        delete Memory.creeps[it]
      }
    })
  } catch (e) {
    console.log(e)
  }
}

module.exports.loop = function () {
  var creepsNumber = Object.keys(Game.creeps).length
  clearCreep(Game.creeps)
  //
  Object.keys(Game.creeps).reverse().forEach((name, index) => {
    var creep = Game.creeps[name];
    var closestHostile = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);

    if (index < worksNumber) {
      if (creep.carry.energy < creep.carryCapacity && creep.memory.mode != 'build' && creep.memory.mode != 'carry') {
        var sources = creep.room.find(FIND_SOURCES);
        const target = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
        var go = null
        if (closestHostile) {
          // hav from stoage
          var storage = creep.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (structure) => {
              return (structure.structureType == STRUCTURE_STORAGE)
            }
          })
          if (creep.withdraw(storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.moveTo(storage);
          }
        } else {
          if (!target || creep.pos.getRangeTo(sources[1].pos) < creep.pos.getRangeTo(target.pos)) {
            go = sources[1]
            var harvestResp = creep.harvest(go)
            console.log(harvestResp)
            if (harvestResp == ERR_NOT_IN_RANGE) {
              creep.moveTo(go);
            }
          } else {
            if (creep.pickup(target) == ERR_NOT_IN_RANGE) {
              creep.moveTo(target);
            } else {
              creep.memory.task = true;
            }
          }
        }

      } else {
        if (creep.carry.energy === 0) {
          creep.memory.mode = ""
        }
        // var targets = creep.room.find(FIND_STRUCTURES, {
        //     filter: (structure) => {
        //         return (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN) &&
        //             structure.energy < structure.energyCapacity;
        //     }
        // });
        var targets = creep.pos.findClosestByPath(
          creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
              return (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN) &&
                structure.energy < structure.energyCapacity;
            }
          })
        );

        var towerTemp = creep.room.find(FIND_STRUCTURES, {
          filter: (structure) => {
            return (structure.structureType == STRUCTURE_TOWER) &&
              structure.energy < structure.energyCapacity;
          }
        }).sort((a, b) => a.energy - b.energy)

        var tower = towerTemp.length > 0 ? towerTemp[0] : null;


        var toBuilds = creep.room.find(FIND_MY_CONSTRUCTION_SITES)

        var storage = creep.pos.findClosestByRange(
          creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
              return (structure.structureType == STRUCTURE_STORAGE) &&
                _.sum(structure.store) < structure.storeCapacity;
            }
          })
        );
        console.log(storage)

        if (targets) {
          creep.memory.mode = "carry"
          //
          if (creep.transfer(targets, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.moveTo(targets, {visualizePathStyle: {stroke: '#ffffff'}});
            creep.memory.tobuilding = false
          }
          // if(creep.carry.energy < 50 ){
          //   creep.memory.mode = 'build'
          // }
          if (creep.carry.energy === 0) {
            creep.memory.mode = ''
          }
        } else if (toBuilds.length > 0) {

          console.log("build!")
          //switch build mode
          creep.memory.mode = "build"

          //find target, or else create one
          var toBuilds = creep.room.find(FIND_MY_CONSTRUCTION_SITES)
          // console.log(toBuilds.length)
          if (toBuilds.length === 0) {
            var poss = getRange2(Game.spawns['test'].pos, 3)
            // console.log(poss)
            for (var pos of poss) {
              // var loca = pos.look()
              // console.log(loca)
              // if(loca.length == 1){
              // can build
              if (creep.room.createConstructionSite(pos, STRUCTURE_EXTENSION) === OK) {
                break;
              }

              // }
            }
          } else {
            // TODO 0
            if (creep.build(toBuilds[0]) == ERR_NOT_IN_RANGE) {
              creep.moveTo(toBuilds[0])
            }
          }

          if (creep.carry.energy === 0) {
            creep.memory.mode = ""
          }


        } else if (tower && tower.energy < tower.energyCapacity / 2) {
          creep.memory.mode = "carry"
          //
          if (creep.transfer(tower, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.moveTo(tower, {visualizePathStyle: {stroke: '#ffffff'}});
            creep.memory.tobuilding = false
          }
          // if(creep.carry.energy < 50 ){
          //   creep.memory.mode = 'build'
          // }
          if (creep.carry.energy === 0) {
            creep.memory.mode = ''
          }
        } else if (storage) {
          creep.memory.mode = "carry"
          //
          var storeResp = creep.transfer(storage, RESOURCE_ENERGY)
          console.log(`stroage resp ${storeResp}`)
          if (storeResp == ERR_NOT_IN_RANGE) {
            creep.moveTo(storage, {visualizePathStyle: {stroke: '#ffffff'}});
            creep.memory.tobuilding = false
          }
          // if(creep.carry.energy < 50 ){
          //   creep.memory.mode = 'build'
          // }
          if (creep.carry.energy === 0) {
            creep.memory.mode = ''
          }
        } else if (tower && tower.energy < tower.energyCapacity / 2) {
          creep.memory.mode = "carry"
          //
          if (creep.transfer(tower, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.moveTo(tower, {visualizePathStyle: {stroke: '#ffffff'}});
            creep.memory.tobuilding = false
          }
          // if(creep.carry.energy < 50 ){
          //   creep.memory.mode = 'build'
          // }
          if (creep.carry.energy === 0) {
            creep.memory.mode = ''
          }
        } else {
          creep.memory.mode = "carry"
          //
          if (creep.transfer(tower, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.moveTo(tower, {visualizePathStyle: {stroke: '#ffffff'}});
            creep.memory.tobuilding = false
          }
          // if(creep.carry.energy < 50 ){
          //   creep.memory.mode = 'build'
          // }
          if (creep.carry.energy === 0) {
            creep.memory.mode = ''
          }
        }
        // var resp = creep.transfer(Game.spawns['test'], RESOURCE_ENERGY)

        // if(resp == ERR_NOT_IN_RANGE && creep.memory.tobuilding!== true) {
        //     creep.moveTo(Game.spawns['test']);
        // }

        // else if(resp == ERR_FULL || creep.memory.tobuilding == true){
        //     creep.memory.tobuilding = true
        //   var buildResp =  creep.build(Game.getObjectById('5cc7364a41676629ed127d5a'))
        //     if(buildResp == ERR_NOT_ENOUGH_RESOURCES){
        //         creep.memory.tobuilding = false
        //     }else if(buildResp == ERR_INVALID_TARGET){
        //         if(creep.build(Game.getObjectById('5cc7362041676629ed127d52')) == ERR_NOT_ENOUGH_RESOURCES){
        //              creep.memory.tobuilding = false
        //         }
        //     }
        // }
      }

      if (closestHostile && creep.carry.energy) {
        // 充能
        creep.memory.mode = "carry"
        //
        if (creep.transfer(tower, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          creep.moveTo(tower, {visualizePathStyle: {stroke: '#ffffff'}});
          creep.memory.tobuilding = false
        }
        // if(creep.carry.energy < 50 ){
        //   creep.memory.mode = 'build'
        // }
        if (creep.carry.energy === 0) {
          creep.memory.mode = ''
        }
      }
    } else if (index < (creepsNumber - worksNumber) / 2 + worksNumber - 1) {
      if (creep.carry.energy < creep.carryCapacity) {
        var sources = creep.room.find(FIND_SOURCES);
        if (creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
          creep.moveTo(sources[0]);
        }
      } else {
        // if(creep.transfer(Game.spawns['test'], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
        //     creep.moveTo(Game.spawns['test']);
        // }
        if (creep.pos.inRangeTo(23, 36, 3)) {
          creep.drop(RESOURCE_ENERGY);
        } else {
          creep.moveTo(23, 36)
        }
      }
      var toBuilds = creep.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 5)
      if (toBuilds.length > 0 && creep.build(toBuilds[0]) == ERR_NOT_IN_RANGE) {
        creep.moveTo(toBuilds[0])
      }
      if (closestHostile) {
        if (creep.pos.x < 24) {
          creep.moveTo(1, 36)
        } else {
          creep.moveTo(45, 19)
        }
      }
    } else {
      if (creep.memory.task == true) {
        var toBuilds = creep.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 5)
        if (toBuilds.length > 0) {
          var target = creep.pos.findClosestByRange(toBuilds)
          if (creep.build(target) == ERR_NOT_IN_RANGE) {
            creep.moveTo(target)
          }
        } else {
          var resp = creep.upgradeController(creep.room.controller)
          if (resp == ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller);
          }
        }
        if (creep.carry.energy == 0) {
          creep.memory.task = false;
        } else {
          creep.memory.task = true;
        }
      } else {
        const target = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
        if (target) {
          if (creep.pickup(target) == ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
          } else {
            creep.memory.task = true;
          }
        } else {
          creep.moveTo(23, 36);
        }
      }

      // if(creep.carry.energy < creep.carryCapacity) {
      //   const target = creep.pos.findClosestByRange(FIND_DROPPED_ENERGY);
      //     if(target) {
      //         if(creep.pickup(target) == ERR_NOT_IN_RANGE) {
      //             creep.moveTo(target);
      //         }
      //     }

      // }
      // else {
      //     if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
      //         creep.moveTo(creep.room.controller);
      //     }
      // }
      //roleUpgrader.run(creep)
      if (closestHostile) {
        creep.moveTo(35, 10)
      }
    }

  })


  // create creep
  if (isFull(Game.spawns.test.room) && Object.keys(Game.creeps).length <= maxCreep || (Object.keys(Game.creeps).length === 0 && getAllEnergy(Game.spawns.test.room) >= 200) || (Object.keys(Game.creeps).length < 3 && getAllEnergy(Game.spawns.test.room) >= 300)) {
    var body = [];
    // if(Game.spawns.test.energy >=400 ){
    // body = [WORK,MOVE,MOVE,CARRY,CARRY,WORK]
    body = prefectWorkerGenerate(getAllEnergy(Game.spawns.test.room))
    // }else if(Game.spawns.test.energy >=350){
    //     body = [WORK,MOVE,MOVE,CARRY,WORK]
    // }else if(Game.spawns.test.energy >=300){
    //     body = [WORK,MOVE,MOVE,CARRY,MOVE]
    // }
    Game.spawns.test.createCreep(body, "test" + new Date().getTime())
  }

  // tower
  Game.spawns.test.room.find(FIND_MY_STRUCTURES, {filter: (it) => it.structureType === STRUCTURE_TOWER}).forEach(tower => {
    var isOK = tower.energy > tower.energyCapacity / 2;


    // var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    // if(closestHostile) {
    //   var resp =  tower.attack(closestHostile);
    //     console.log(`be attacked! ${new Date().toLocaleString} ; resp:${resp}`)
    // }
    // first kill heal creep
    var hostile = tower.room.find(FIND_HOSTILE_CREEPS).sort((a, b) => {
      try {
        return b.body.filter(it => it.type === HEAL).length - a.body.filter(it => it.type === HEAL).length
      } catch (e) {
        Memory.lastError = e;
        return 0;
      }
    })
    if (hostile.length > 0) {
      Memory.lastBeAttack = hostile
      var resp = tower.attack(hostile[0]);
      console.log(`be attacked! ${new Date().toLocaleString} ; resp:${resp}`)
    } else {
      var closestDamagedStructure = tower.room.find(FIND_STRUCTURES, {
        filter: (structure) => structure.hits < structure.hitsMax
      }).sort((a, b) => a.hits - b.hits);

      if (closestDamagedStructure.length > 0 && isOK) {
        tower.repair(closestDamagedStructure[0]);
      }
    }

  })
  // ensure road
  getEnsureRoad(Game.spawns.test.room).forEach(it => {
    Game.spawns.test.room.createConstructionSite(it, STRUCTURE_ROAD)
  })
}
