//import './style.css'

document.querySelector('#app').innerHTML = `
  <div>
    <canvas id='myCanvas'></canvas>
  </div>
`

let canvas = document.getElementById('myCanvas')
let ctx = canvas.getContext('2d')


const SIZE = 600
const CELLSIZE = 30
canvas.width = 1650;
canvas.height = 850;

let _inputData

let GEN = 1
let killPercent = 20

let TPS = 30
let FPS = 30
let TICK = 0
let SPEED = 30
let TIME = 0
let TIMESTEP = 1000/FPS
let CLOCK = 0
let temp_CLOCK = 0
let FOOD_TIME = 0.2 * TPS
let FOOD_TIMER = 0
let ROUND_TIME = 5 * TPS
let ROUND_TIMER = 0
let ENERGY_TIME = 0.2 * TPS
let ENERGY_TIMER = 0

let PAUSED = false

//'eexa9lseir' 
let SEED = Math.random().toString(36).substring(2,12)
let random = new Random(SEED)


function createGrid(x, y, fill) {
  return new Array(y).fill(null).map(() => new Array(x).fill(fill))
}

function range(from, to) {
  return ~~(random() * (to - from) + from)
}

const numBacteria = 60
const BRAINSIZE = 20

let orientations = [[0, 1], [1, 0], [0, -1], [-1, 0]]

const TYPES = {
  special: ['pass', 'pool', 'hold', 'clock'],
  logic: ['and', 'or', 'not']
}

const TYPES_RANGES = {
  pool: [1, 3],
  hold: [3, 5]
}

const TYPE_CHANCE = {
  logic: {
    or: 0.3,
    and: 0.7,
    nor: 1
  },

  type: {
    processor: 0.9,
    generator: 1
  },

  special: {
    processor: {
      pass: 0.8,
      pool: 0.9,
      hold: 1
    },
    
    generator: {
      clock: 1
    }
  }
}

TYPE_COLORS = {

  logic: {
    or: 'yellow',
    and: 'red',
    nor: 'green'
  },

  type: {
    input:['#302a14', 'yellow'],
    output:['#141f19', 'green'],
    pass:['#40222a', '#6430ff'],
    pool:['#535561', '#1b0f69'],
    hold:['#4e5e3f', '#32a852'],
    clock:['#2b171a', '#910000']
  }
}

//LOGIC
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n))
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function posToIdString(x, y) {
  return x.toString() + '_' + y.toString()
}

function idStringToPos(string) {
  return string.split('_').map((a) => {return Number(a)})
}

function deepCopy(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Set) {
    return new Set([...obj].map(x => deepCopy(x)));
  }

  if (obj instanceof Map) {
    return new Map([...obj].map(([k, v]) => [deepCopy(k), deepCopy(v)]));
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags);
  }

  if (obj.constructor === Array) {
    return obj.map(x => deepCopy(x));
  }

  const copy = Object.create(Object.getPrototypeOf(obj));
  for (const key of Object.keys(obj)) {
    copy[key] = deepCopy(obj[key]);
  }
  return copy;
}


const logic = {
  or: (input) => {
    for (let i = 0; i < input.length; i++) {
      if(input[i] == true){
        return true
      }
    }
    return false
  },
  and: (input) => {
    for (let i = 0; i < input.length; i++) {
      if(input[i] == false){
        return false
      }
    }
    return true
  },
  nor: (input) => {
    for (let i = 0; i < input.length; i++) {
      if(input[i] == true){
        return false
      }
    }
    return true
  }
}

const processor = {
  pool: (neuron, signal) => {
    let lastSignal
    
    if (lastSignal == undefined) {
      lastSignal = signal
    }

    if (lastSignal == !signal) {
      lastSignal = signal
    }

    if (signal == true) {
      neuron.vars[0] ++
    }

    if (neuron.vars[0] == neuron.vars[1]) {
      neuron.vars[0] = 0
    }

    if (neuron.vars[0] == 0) {
      return true
    } else {
      return false
    }
  },
  hold: (neuron, signal) => {
    let lastSignal
    
    if (lastSignal == undefined) {
      lastSignal = signal
    }

    if (lastSignal == !signal) {
      lastSignal = signal
    }

    if (signal == true) {
      neuron.vars[0] ++
    }

    if (neuron.vars[0] == neuron.vars[1]) {
      neuron.vars[0] = 0
    }

    if (neuron.vars[0] < neuron.vars[1]) {
      return true
    } else {
      return false
    }
  }
}

const MUTATION_CHANCE = {
  addNeuron: 10,
  removeNeuron: 10,
  addSynapse: 20,
  removeSynapse: 20
}

const MUTATION_QUANTITY = {
  addNeuron: 3,
  removeNeuron: 3,
  addSynapse: 8,
  removeSynapse: 6
}

class Neuron {
  constructor(logic = 'or', type = 'pass', max = 3) {
    this.x
    this.y
    this.id
    this.type = type
    this.firing = false
    this.ins = new Set()
    this.outs = new Set()
    this.max = max
    this.inputsRecieved = []
    this.vars
    this.duty = 'generic'
    this.logic = logic
  }

  copy() {
    let copy = new Neuron()
    copy.x = this.x
    copy.y = this.y
    copy.id = this.id
    copy.type = this.type
    copy.firing = this.firing
    if(this.ins) {copy.ins = new Set(this.ins)} else {copy.ins = null}
    if(this.outs) {copy.outs = new Set(this.outs)} else {copy.outs = null}
    copy.max = this.max
    copy.inputsRecieved = this.inputsRecieved
    copy.vars = this.vars
    copy.duty = this.duty
    copy.logic = this.logic
  
    return copy
  }
}

function createRandomNeuron() {
  let neuron
  let chance = random()
  let logic
  let kind
  let type
  
  if(chance < TYPE_CHANCE.type.processor) {
    kind = 'processor'
  } else if(chance < TYPE_CHANCE.type.generator) {
    kind = 'generator'
  }
  
  if(kind == 'processor') {
    chance = random()

    if(chance < TYPE_CHANCE.logic.or) {
      logic = 'or'
    } else if(chance < TYPE_CHANCE.logic.and) {
      logic = 'and'
    } else if(chance < TYPE_CHANCE.logic.nor) {
      logic = 'nor'
    }
    
    chance = random()
    
    if(chance < TYPE_CHANCE.special.processor.pass) {
      type = 'pass'
    } else if(chance < TYPE_CHANCE.special.processor.pool) {
      type = 'pool'
    } else if(chance < TYPE_CHANCE.special.processor.hold) {
      type = 'hold'
    }
    
    neuron = new Neuron(logic, type)
    
    if(type == 'hold' || type == 'pool') {
      neuron.vars = [0, range(TYPES_RANGES[type][0], TYPES_RANGES[type][1])]
    }
  } else {
    neuron = new Neuron('null', 'clock')
    neuron.ins = null
    neuron.vars = [~~(random() * 5) + 5]
  }
  return neuron
}

class Brain {
  constructor(size = BRAINSIZE, inputs = 9, outputs = 3) {
    this.size = size
    this.inputs = inputs
    this.outputs = outputs
    this.neurons = []
    this.freeSpots
    this.freeSynapses
  }

  copy() {
    let copy = new Brain()
    copy.size = this.size
    copy.inputs = this.inputs
    copy.outputs = this.outputs
    copy.neurons = this.neurons.map((n) => {return n.copy()})
    copy.freeSpots = this.freeSpots
    copy.freeSynapses = this.freeSynapses
  
    return copy
  }

  randomize = (numNeurons = 5, numSynapses = 10) => {
    //this.neurons = []
    this.addRandomNeurons(numNeurons)
    this.addRandomSynapses(numSynapses, 100)
  }

  getFreeSpots() {
    //matrix representing free the brain
    let matrix = createGrid(this.size, this.size, 1)
    
    for(let i = 0; i < this.neurons.length; i++) {
      matrix[this.neurons[i].y][this.neurons[i].x] = 0 
    }

    //convert matrix to an 1d array containing free spots
    let freeSpots = []

    for(let x = 0; x < this.size; x++) {
      for(let y = 0; y < this.size; y++) {
        if(matrix[y][x] === 1) {
          freeSpots.push([x, y])
        }
      }
    }

    //console.log(freeSpots)
    this.freeSpots = freeSpots
    return freeSpots 
  }

  addRandomNeuron() {
    let freeSpots = this.getFreeSpots()
    let randomSpot = freeSpots[~~(random() * freeSpots.length)]

    let randomX = randomSpot[0]
    let randomY = randomSpot[1]
    
    let neuron = createRandomNeuron()
    //console.log(neuron)
    neuron.x = randomX
    neuron.y = randomY

    neuron.id = posToIdString(neuron.x, neuron.y)

    this.neurons.push(neuron)
  }
 
  addRandomNeurons(amount = 1) {
    for(let i = 0; i < amount; i++) {
      this.addRandomNeuron()
    }
  }
  
  removeRandomNeurons(amount = 1) {
    for(let i = 0; i < amount; i++) {

      
      let generics = this.neurons.filter((n) => {return n.type == 'pass'})
      
      if(generics.length > 0) {
        let index = ~~(random() * generics.length)
        
        let neuron = generics[index]
  
        this.removeNeuron(neuron)
      }
      
    }
  }

  removeNeuron(neuron) {
    // return early if neuron is of type 'input' or 'output'
    if (neuron.type === 'input' || neuron.type === 'output') {
      return;
    }
  
    // remove neuron from array of neurons
    let index = this.neurons.indexOf(neuron);
    if (index > -1) {
      this.neurons.splice(index, 1);
    }
  
    // remove neuron's id from other neurons' ins and outs
    this.neurons.forEach(n => {
      if(n.ins) {
        n.ins.delete(neuron.id);
      }
      if(n.outs) {
        n.outs.delete(neuron.id);
      }
    });
  }

  removeRandomSynapse() {
    // check if there are any neurons with outgoing synapses
    let hasSynapses = false;
    for (let n of this.neurons) {
      if (n.outs !== null && n.outs.size > 0) {
        hasSynapses = true;
        break;
      }
    }
    if (!hasSynapses) {
      return;
    }
  
    // pick a random neuron that has at least one outgoing synapse
    let neuronWithSynapses;
    do {
      neuronWithSynapses = this.neurons[Math.floor(Math.random() * this.neurons.length)];
    } while (neuronWithSynapses.outs === null || neuronWithSynapses.outs.size === 0);
  
    // pick a random outgoing synapse from the neuron
    let randomOut = Array.from(neuronWithSynapses.outs)[Math.floor(Math.random() * neuronWithSynapses.outs.size)];
  
    // find the neuron that the randomOut synapse is connected to
    let targetNeuron;
    for (let n of this.neurons) {
      if (n.id === randomOut) {
        targetNeuron = n;
        break;
      }
    }
  
    // remove the synapse from both neurons
    neuronWithSynapses.outs.delete(randomOut);
    targetNeuron.ins.delete(neuronWithSynapses.id);
  }
  

  setInputsAndOutputs() {
    for(let i = 0; i < this.inputs; i++) {
      let neuron = new Neuron(null, 'input')
      neuron.ins = null
      neuron.x = i
      neuron.y = 0
      neuron.id = posToIdString(neuron.x, neuron.y)
      this.neurons.push(neuron)
    }

    for(let i = 0; i < this.outputs; i++) {
      let neuron = new Neuron('or', 'output')
      neuron.outs = null
      neuron.x = this.size - 1 - i
      neuron.y = this.size - 1
      neuron.id = posToIdString(neuron.x, neuron.y)
      this.neurons.push(neuron)
    }
  }

  addSynapse = (a, b) => {
    a.outs.add(b.id)
    b.ins.add(a.id)
  }

  removeSynapse = (a, b) => {
    this.getNeuron(a).outs.delete(b)
    this.getNeuron(b).ins.delete(a)
  }

  availableIns = () => {
    let ins = []
    for(let i = 0; i < this.neurons.length; i++) {
      if(this.neurons[i].ins != null) {
        for(let j = 0; j < this.neurons[i].max - this.neurons[i].ins.size; j++) {
          ins.push([this.neurons[i].id])
        }
      }
    }

    return ins
  }

  availableOuts() {
    let outs = []
    for(let i = 0; i < this.neurons.length; i++) {
      if(this.neurons[i].outs != null) {
        for(let j = 0; j < this.neurons[i].max - this.neurons[i].outs.size; j++) {
          outs.push([this.neurons[i].id])
        }
      }
    }

    return outs
  }

  takenOuts() {
    let outs = []
    for(let i = 0; i < this.neurons.length; i++) {
      if(this.neurons[i].outs != null) {
        for(let j = this.neurons[i].max - this.neurons[i].outs.size; j < this.neurons[i].max; j++) {
          outs.push([this.neurons[i].id])
        }
      }
    }

    return outs
  }

  addRandomSynapses(numSynapses, numTries = numSynapses * 100) {
    if(this.neurons.length > 0) {

      let availableOuts = this.availableOuts()
      let availableIns = this.availableIns()

      if (availableOuts.length > 0 && availableIns.length > 0) {
        for (let i = 0; i < numSynapses; i++) {

          let a = availableOuts[~~(random() * availableOuts.length)]
          let b = availableIns[~~(random() * availableIns.length)]
  
          let neuronA = this.neurons.filter((neuron) => {
            return neuron.id == a
          })[0]
  
          let neuronB = this.neurons.filter((neuron) => {
            return neuron.id == b
          })[0]
  
          if(a !== b) {
            this.addSynapse(neuronA, neuronB)
          }
        }
      }
    } else {
      console.log('no neurons! can\'t link no neurons!')
    }
  }

  mutate() {
    if(random() * 100 < MUTATION_CHANCE.addNeuron) {
      this.addRandomNeurons(~~(random() * MUTATION_QUANTITY.addNeuron))
    }

    if(random() * 100 < MUTATION_CHANCE.addSynapse) {
      this.addRandomSynapses(~~(random() * MUTATION_QUANTITY.addSynapse))
    }

    for(let i = 0; i < ~~(random() * MUTATION_QUANTITY.removeSynapse); i++) {
      if(random() * 100 < MUTATION_CHANCE.removeRandomSynapse) {
        this.removeRandomSynapse()
      }
    }

    if(random() * 100 < MUTATION_CHANCE.removeNeuron) {
      this.removeRandomNeurons(~~(random() * MUTATION_QUANTITY.removeNeuron))
    }
  }

  feedInput(input) {

    let inputs = this.neurons.filter((neuron) => {return neuron.type == 'input'})

    for(let i = 0; i < input.length; i++) {
      
      //inputs[i].fired = input[i]
      
      this.getNeuron(inputs[i].id).firing = input[i]

    }
  }
  

  inputNoise() {

    let inputs = this.neurons.filter((neuron) => {return neuron.type == 'input'})

    for(let i = 0; i < inputs.length; i++) {
      inputs[i].fired = false
      inputs[i].firing = random() < 0.5
    }
  }
  outputNoise() {
    let output = this.getOutputs()

    for(let i = 0; i < output.length; i++) {
      output[i].firing = random() < 0.5
    }
  }


  forceOutput() {
    let output = this.getOutputs()

    if(CLOCK % 2 == 0) output[1].firing = true
    else {
      output[1].firing = false
    }
  }

  clearFire() {
    for (const neuron of this.neurons) {
      neuron.firing = false
    }
  }

  setFire(id, signal) {
    this.neurons.find((n) => n.id === id).firing = signal
  }



  getNeuron(id) {
    return this.neurons.find((neuron) => {return neuron.id === id})
  }

  getNeighbours(node) {
    // Get the IDs of the nodes that are connected to the input node
    const neighborIds = [...node.outs.values()];
    //console.log(neighborIds)
    // Find the nodes in the graph that have these IDs
    const neighbors = this.neurons.filter(n => neighborIds.includes(n.id));
  
    return neighbors;
  }

  fire(neuron) {
    // Define a queue to store the output neurons
    let clocks = [...this.getGenerators()]
    
    let queue = [...[...this.getInputs()].map((n) => {return n.id}),...[...clocks.map((n) => {return n.id})]];
    
    clocks = clocks.map((n) => {CLOCK % n.vars[0] == 0 ? n.firing = true : n.firing = false})

    //console.log(queue)
    // Keep track of the nodes that have been visited
    const visited = new Set()

    // Store the firing status of all neurons in the queue
    const firingStatus = new Map();
    while (queue.length > 0) {
        let currentNeuron = queue.shift();
        currentNeuron = this.getNeuron(currentNeuron);
        firingStatus.set(currentNeuron.id, currentNeuron.firing);

        if(currentNeuron.outs) {
            let neighbours = this.getNeighbours(currentNeuron);
            for (const out of neighbours) {
                if(out.outs) {
                    if(out.outs.size > 0) {
                        if (!visited.has(out.id)) {
                            queue.push(out.id);
                            visited.add(out.id);
                        }
                    }
                }
            }
        }
    }

    // Process the outputs of all neurons
    visited.clear();
    queue = [...this.getInputs()].map((n) => {return n.id});
    while (queue.length > 0) {
        let currentNeuron = queue.shift();
        currentNeuron = this.getNeuron(currentNeuron);

        if(currentNeuron.outs) {
            let neighbours = this.getNeighbours(currentNeuron);
            for (const out of neighbours) {
                for (let i = 0; i < out.ins.size; i++) {
                    out.inputsRecieved.push(firingStatus.get(this.getNeuron([...out.ins.keys()][i]).id));
                }
                if (out.logic == 'or') {
                    out.firing = logic.or(out.inputsRecieved);
                } else if (out.logic == 'and') {
                    out.firing = logic.and(out.inputsRecieved);
                } else if (out.logic == 'nor') {
                    out.firing = logic.nor(out.inputsRecieved);
                }
                out.inputsRecieved = [];

                if(out.outs) {
                    if(out.outs.size > 0) {
                        if (!visited.has(out.id)) {
                            queue.push(out.id);
                            visited.add(out.id);
                        }
                    }
                }
            }
        }
    }
}

  getInputs() {
    return this.neurons.filter((neuron) => {return neuron.type == 'input'})
  }

  getOutputs() {
    return this.neurons.filter((neuron) => {return neuron.type == 'output'})
  }

  getGenerators() {
    return this.neurons.filter((neuron) => {return neuron.type == 'clock'})
  }
}

function drawArrow(fromx, fromy, tox, toy, arrowWidth, color) {
  //variables to be used when creating the arrow
  var headlen = 10;
  var angle = Math.atan2(toy-fromy,tox-fromx);

  ctx.save();
  //ctx.strokeStyle = color;

  //starting path of the arrow from the start square to the end square
  //and drawing the stroke
  ctx.beginPath();
  ctx.moveTo(fromx, fromy);
  ctx.lineTo(tox, toy);
  ctx.lineWidth = arrowWidth;
  ctx.stroke();

  //starting a new path from the head of the arrow to one of the sides of
  //the point
  ctx.beginPath();
  ctx.moveTo(tox, toy);
  ctx.lineTo(tox-headlen*Math.cos(angle-Math.PI/7),
             toy-headlen*Math.sin(angle-Math.PI/7));

  //path from the side point of the arrow, to the other side point
  ctx.lineTo(tox-headlen*Math.cos(angle+Math.PI/7),
             toy-headlen*Math.sin(angle+Math.PI/7));

  //path from the side point back to the tip of the arrow, and then
  //again to the opposite side point
  ctx.lineTo(tox, toy);
  ctx.lineTo(tox-headlen*Math.cos(angle-Math.PI/7),
             toy-headlen*Math.sin(angle-Math.PI/7));

  //draws the paths created above
  ctx.stroke();
  ctx.restore();
}

//RENDERG FUNCTION
function renderBrain(brain, x = 0, y = 0, size = 100) {
  
  let cellsize = ~~(size / brain.size)
  
  let specialtySize = cellsize * 0.8

  let specialtyX = (cellsize - specialtySize) / 2
  let specialtyY = (cellsize - specialtySize) / 2
  
  //CLEAR CANVAS

  //EMPTY CELLS
  for(let i = 0; i < brain.size; i++) {
    for(let j = 0; j < brain.size; j++) {
      ctx.fillStyle = '#525252'
      ctx.fillRect(i * cellsize + x, j * cellsize + y, cellsize, cellsize)
      ctx.strokeStyle = 'gray'
      ctx.strokeRect(i * cellsize + x, j * cellsize + y, cellsize, cellsize)
    }
  }
  
  //NEURONS

  //LOGIC
  for(let i = 0; i < brain.neurons.length; i++) {
    if(brain.neurons[i].firing) {
      ctx.fillStyle = TYPE_COLORS.logic[brain.neurons[i].logic]
    } else {
      ctx.fillStyle = 'BLACK'//TYPE_COLORS.logic[brain.neurons[i].logic]''
    }
    ctx.fillRect(brain.neurons[i].x * cellsize + x, brain.neurons[i].y * cellsize + y, cellsize, cellsize)
    ctx.strokeStyle = 'black'
    ctx.strokeRect(brain.neurons[i].x * cellsize + x, brain.neurons[i].y * cellsize + y, cellsize, cellsize)
    ctx.font = "10px Arial";
    ctx.fillStyle = 'white'
  }

  //SPECIALTY TYPE
  for(let i = 0; i < brain.neurons.length; i++) {
    if(brain.neurons[i].firing) {
      ctx.fillStyle = TYPE_COLORS.type[brain.neurons[i].type][1]
    } else {
      ctx.fillStyle = TYPE_COLORS.type[brain.neurons[i].type][0]
    }
    ctx.fillRect(brain.neurons[i].x * cellsize + specialtyX + x, brain.neurons[i].y * cellsize + specialtyY + y, specialtySize, specialtySize)
    ctx.strokeStyle = 'black'
    //ctx.strokeRect(brain.neurons[i].x * specialtySize + specialtyX, brain.neurons[i].y * specialtySize + specialtyY, cellsize, cellsize)
    ctx.font = "10px Arial";
    ctx.fillStyle = 'white'

    ctx.fillText(`${brain.neurons[i].logic} ${brain.neurons[i].type}`, brain.neurons[i].x * cellsize + x + 10, brain.neurons[i].y * cellsize + y + 20);
  }

  //WIRING
  for(let i = 0; i < brain.neurons.length; i++) {
    if(brain.neurons[i].firing) {
      ctx.strokeStyle = '#ceadd9'
    } else {
      ctx.strokeStyle = '#242424'
    }
    if(brain.neurons[i].outs != undefined) {
      if(brain.neurons[i].outs.size > 0) {
        for(let j = 0; j < brain.neurons[i].outs.size; j++) {
          let neuronA = brain.neurons[i]
          let neuronB = brain.neurons.filter((neuron) => {
            return neuron.id == Array.from(neuronA.outs.values())[j]
          })[0]
          
          drawArrow(neuronA.x * cellsize + x + cellsize/2,neuronA.y * cellsize + y + cellsize/2, neuronB.x * cellsize + x + cellsize/2, neuronB.y * cellsize + y + cellsize/2, 2)
        }
      }
    }
    
    
  }


// '#c4db86'
// '#353625'
// 'red'
// '#353625'
}

const bodyStatRange = {
  maxHP: [50, 100],
  maxEnergy: [100, 300],
  moveCost: [1, 2],
  hungerCost: [1, 2]
}

class Body {
  constructor() {
    this.maxHP
    this.HP
    this.maxEnergy
    this.energy
    this.moveCost
  }

  copy() {
    let copy = new Body()

    copy.maxHP = this.maxHP
    copy.HP = this.HP
    copy.maxEnergy = this.maxEnergy
    copy.energy = this.energy
    copy.moveCost = this.moveCost
  
    return copy
  }

  randomize() {
    this.maxHP = range(bodyStatRange.maxHP[0], bodyStatRange.maxHP[1])
    this.maxEnergy = range(bodyStatRange.maxEnergy[0], bodyStatRange.maxEnergy[1])
    this.moveCost = range(bodyStatRange.moveCost[0], bodyStatRange.moveCost[1])
    this.hungerCost = range(bodyStatRange.hungerCost[0], bodyStatRange.hungerCost[1])
  }

  refill() {
    this.HP = this.maxHP
    this.energy = this.maxEnergy
  }

  changeStat(stat, value) {
    this[stat] += value
  }

  mutate() {
    this.changeStat('maxHP', range(0, 10))
    this.changeStat('maxEnergy', range(0, 3))
    this.changeStat('moveCost', range(0, 1))
  }
}

class Bacteria {
  constructor(brain) {
    this.name
    this.brain = brain
    this.body
    this.alive = true
    this.color
    this.speed = 0
    this.gen = 0
    this.timeAlive = 0
    this.foodsConsumed = 0
    this.oldX
    this.oldY
    this.x
    this.y
    this.orientation
  }

  copy() {
    const copy = new Bacteria();
    copy.name = this.name;
    copy.rotation = this.rotation;
    copy.brain = this.brain.copy();
    copy.body = this.body.copy();
    copy.alive = this.alive;
    copy.color = this.color;
    copy.speed = this.speed;
    copy.gen = this.gen;
    copy.timeAlive = this.timeAlive;
    copy.foodsConsumed = this.foodsConsumed;
    copy.x = this.x;
    copy.y = this.y;
    copy.orientation = this.orientation;
    return copy;
}

  
  createRandomName(){
    const syllables = ['bac', 'ter', 'ia', 'coc', 'cus', 'stre', 'pco', 'mon', 'sal', 'mar', 'mob', 'fil', 'cur', 'vib', 'pro', 'myc'];
    let nameHolder = '';
    for (let i = 0; i < 3; i++) {
      nameHolder += syllables[Math.floor(Math.random() * syllables.length)];
    }
    this.name = nameHolder
  }

  copyDataFrom = (bacteria) => {
    this.name = bacteria.name
    this.brain
    this.body
    this.alive = bacteria.alive
    this.color = bacteria.color
    this.speed = bacteria.speed
    this.gen = bacteria.gen
    this.timeAlive = bacteria.timeAlive
    this.foodsConsumed = bacteria.foodsConsumed
    this.x = bacteria.x
    this.y = bacteria.y
    this.orientation = bacteria.orientation
  }

  blank = () => {
    this.brain = new Brain()
    this.body = new Body()
  }

  //create a gen 1 species, randomize everything
  init = () => {
    this.gen = 1
    this.body = new Body()
    this.body.randomize()
    this.body.refill()
    this.createRandomName()
    this.color = randomColorHSL()
    this.orientation = ~~(random() * 4)

    this.brain = new Brain()
    this.brain.setInputsAndOutputs()
    this.brain.randomize()
  }

  mutate = () => {
    this.brain.mutate()
    this.body.mutate()
  }
}

function debugBrain(brain) {
  ctx.font = "10px Arial";
  ctx.fillStyle = 'white'

  for(let i = 0; i < brain.neurons.length; i++) {
    ctx.fillText(`Neuron ${brain.neurons[i].id}: ${brain.neurons[i].firing}`, 10, SIZE - 180 + (i * 10));
  }
}

function lastGenScore() {
  ctx.font = "10px Arial";
  ctx.fillStyle = 'white'

  for(let i = 0; i < manager.score.length; i++) {
    ctx.fillText(`${manager.lastScore[i][0]}: ${manager.score[i][1]}`, 1300, 30 + (i * 10));
  }
}

let foodEnergy = 100
let foodReward = 1000

// 0 - empty space, 1 - wall, 2 - organism, 3 - food

function randomColor() {
  return '#' + Math.floor(random()*16777215).toString(16)
}

function randomColorHSL(h, s, l) {
  var h = ~~(random() * 360);
  var s = range(80, 100);
  var l = range(0, 100);
  return 'hsl(' + h + ',' + s + '%,' + l + '%)';
}

const terrainColors = {
  emptySpace: '#828282',
  wall: '#100216',
  food: '#32f20f',
  organism: '#AF6566'
} 

class petriDish {
  constructor(width, height, res = 30) {
    this.width = width
    this.height = height
    this.res = res
    this.tileSize = SIZE/this.res
    this.data = createGrid(res, res, 'e')
    this.feedingTimer = 12
    this.feedingAmount = 5
    this.organismData = []
    this.organismColors = []
    this.manager
  }

  roundLoop = () => {
    if(ROUND_TIMER < ROUND_TIME) {
      PAUSED = false

      ROUND_TIMER ++
    } else {
      //PAUSED = true 
      this.reset()
      extractColors()
    }
  }

  emptyRoom = () => {
    this.data = createGrid(this.res, this.res, 'e')

    for(let i = 0; i < this.res; i++) {
      for(let j = 0; j < this.res; j++) {
        if(i == 0 || j == 0 || i == this.res-1 || j == this.res-1) {
          this.data[j][i] = 'w'
        }
      }
    }
  }

  linkManager(manager) {
    this.manager = manager
  }

  dropFood = (amount = this.feedingAmount) => {
    for(let i = 0; i < amount; i++) {
      let randomX = ~~(random() * this.res - 2) + 1
      let randomY = ~~(random() * this.res - 2) + 1

      while(!(this.data[randomY][randomX] == 'e')) {
        randomX = ~~(random() * this.res - 2) + 1
        randomY = ~~(random() * this.res - 2) + 1
      }
      this.data[randomY][randomX] = 'f'
    }
  }

  getOrganismData = () => {
    this.organismData = []
    for(let i = 0; i < this.manager.species.length; i++) {
      this.organismData.push([
        this.manager.species[i].x,
        this.manager.species[i].y,
        this.manager.species[i].orientation
      ])
    }
  }

  extractColors = () => {
    for(let i = 0; i < this.manager.species.length; i++) {
      this.organismColors.push(this.manager.species[i].color)
    }
  }

  placeBacteria = () => {
    
    for(let i = 0; i < this.manager.species.length; i++) {
    
      let randomX = ~~(random() * (this.res - 2)) + 1
      let randomY = ~~(random() * (this.res - 2)) + 1
      //console.log(this.manager.species[i].id)

      while(this.data[randomY][randomX] == this.manager.species[i].id) {
        randomX = ~~(random() * (this.res - 2)) + 1
        randomY = ~~(random() * (this.res - 2)) + 1
      }
      
      this.manager.species[i].x = randomX
      this.manager.species[i].y = randomY
  
      this.data[randomY][randomX] = manager.species[i].id
    }
  }
  
  reset = () => {
    this.data = createGrid(this.res, this.res, 'e')
    this.emptyRoom()
    this.getOrganismData()
    this.placeBacteria()
  }

  moveBacteria = () => {
    for(let i = 0; i < this.manager.species.length; i++) {
      
      if(this.manager.species[i].alive) {
        let bacteria = this.manager.species[i]
        let ori = bacteria.orientation
        let bacteriaOutputs = [...bacteria.brain.getOutputs().map((n) => {return n.firing}).values()]
  
        if(bacteriaOutputs[0] == true && bacteriaOutputs[2] == true) {
  
        } else if (bacteriaOutputs[0] == true && bacteriaOutputs[2] == false) {
          bacteria.orientation = (ori + 1) % 4
        } else if (bacteriaOutputs[0] == false && bacteriaOutputs[2] == true) {
          bacteria.orientation = (ori + 3) % 4
        }
  
        let facingX = bacteria.x + orientations[ori][0]
        let facingY = bacteria.y + orientations[ori][1]
        //console.log(bacteria.x, bacteria.y, orientations[ori][0], orientations[ori][1])
        //console.log(ori)
        
        if(facingX < this.res && facingY < this.res && facingX > 0 && facingY > 0) {
          let facing = this.data[facingY][facingX]
  
          if(bacteriaOutputs[1] == true) {
            if(facing == 'f') {
  
              this.data[facingY][facingX] = bacteria.id
              this.data[bacteria.y][bacteria.x] = 'e'
              bacteria.x = facingX
              bacteria.y = facingY
              bacteria.foodsConsumed += foodReward
              bacteria.body.HP += foodEnergy
              bacteria.body.energy += foodEnergy
              if(bacteria.body.HP > bacteria.body.maxHP) {
                bacteria.body.HP = bacteria.body.maxHP
              }
  
            } else if (facing == 'e') {
              if(bacteria.body.energy > 0) {
              //console.log(bacteriaOutputs)
              this.data[facingY][facingX] = bacteria.id
              this.data[bacteria.y][bacteria.x] = 'e'
              bacteria.x = facingX
              bacteria.y = facingY
              bacteria.body.energy -= bacteria.body.moveCost
              }
            }
          }
        }
      }
    }
  }

  render = () => {
    let foodSize = this.tileSize * 0.3
    let foodOffset = (this.tileSize - foodSize) / 2
    let foodBG = 4


    for(let x = 0; x < this.res; x++) {
      for(let y = 0; y < this.res; y++) {
        let tile = this.data[y][x]
        switch(tile){
          case 'e':
            ctx.fillStyle = terrainColors.emptySpace
            ctx.fillRect(x * this.tileSize + 30, y * this.tileSize + 30, this.tileSize, this.tileSize)

            break

          case 'w':
            ctx.fillStyle = terrainColors.wall
            ctx.fillRect(x * this.tileSize + 30, y * this.tileSize + 30, this.tileSize, this.tileSize)

            break

          case 'f':
            ctx.fillStyle = terrainColors.emptySpace
            ctx.fillRect(x * this.tileSize + 30, y * this.tileSize + 30, this.tileSize, this.tileSize)
            ctx.fillStyle = 'black'
            ctx.fillRect(x * this.tileSize + 30 + foodOffset - foodBG, y * this.tileSize + 30 + foodOffset - foodBG, foodSize + foodBG * 2, foodSize + foodBG * 2)
            ctx.fillStyle = terrainColors.food
            ctx.fillRect(x * this.tileSize + 30 + foodOffset, y * this.tileSize + 30 + foodOffset, foodSize, foodSize)


          break

          default:

            ctx.fillStyle = this.organismColors[tile]
            ctx.fillRect(x * this.tileSize + 30, y * this.tileSize + 30, this.tileSize, this.tileSize)
            //console.log(this.manager.species[tile].body)
            ctx.fillText(`${this.manager.species[tile].body.energy}`, x * this.tileSize + 40, y * this.tileSize)
            ctx.fillText(`${this.manager.species[tile].body.HP}`, x * this.tileSize + 40, y * this.tileSize + 20)

          break
        }
      }
    }
  }
}


//console.log(petriDish.data)

let rotatoMe = [
  [1,2,3],
  [4,5,6],
  [7,8,9]
]

let rotateArray = {}

rotateArray.clockWise = (array) => {

  let rows = array.length
  let cols = array[0].length

  let temp = createGrid(rows, cols, 0)

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      temp[j][i] = array[i][j];
    }
  }

  for (let i = 0; i < rows; i++) {
    temp[i].reverse()
  }


  return temp
}

rotateArray.counterClockWise = (array) => {

  let rows = array.length
  let cols = array[0].length

  let temp = createGrid(rows, cols, 0)

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      temp[j][i] = array[i][j];
    }
  }

  temp.reverse()

  return temp
}

class SpeciesManager {
  constructor() {
    this.sensorGrid = [
      ['v1','v2','v3'],
      ['t1','b' ,'t2'],
      ['x' ,'t3','x'],
    ]
    
    this.petriDish
    this.species = []
    this.speciesSensoryData = []
    this.inputData = []
    this.score = []
    this.gens = []
    this.lastScore = []
    this.scores = []
  }

  linkPetriDish = (petriDish) => {
    this.petriDish = petriDish
  }

  getSensoryData = () => {
    for(let i = 0; i < this.species.length; i++) {
      let x = this.species[i].x
      let y = this.species[i].y

      const surroundingData = createGrid(3,3,0);

      for (let i = 0; i < this.sensorGrid.length; i++) {
        for (let j = 0; j < this.sensorGrid[i].length; j++) {
          const element = this.sensorGrid[j][i];
          if (element !== 'x' && element !== 'b') {
            let petriX = x + i - 1
            let petriY = y + j - 1

            if(x < this.petriDish.res && y < this.petriDish.res && x > 0 && y > 0) {
              surroundingData[j][i] = this.petriDish.data[petriY][petriX];
            }
          }
        }
      }
      this.speciesSensoryData[i] = surroundingData
      //console.log(surroundingData)
    }
  }

  rank = () => {
    this.score = new Array()

    for(let i = 0; i < this.species.length; i++) {
      let bacteria = this.species[i]

      if(bacteria.timeAlive == 0) {
        bacteria.timeAlive = CLOCK
      }

      this.score.push([bacteria.gen + '_' + bacteria.id + '_' + bacteria.name, bacteria.foodsConsumed])
    }
    this.score.sort((a,b) => b[1]-a[1])
  }

  saveGen = () => {
    this.gens.push(deepCopy(this.species))
  }

  killHalf(count = ~~(this.species.length / 2)) {
    this.survivorCount = this.species.length - ~~(this.species.length / 2)
  this.sort()
    this.species.splice(0, count)
  }

  killPercent(percent = killPercent) {
    this.survivorCount = ~~(this.species.length * killPercent/100)
  this.sort()
    this.speciesTemp = this.species.splice(0, this.species.length - this.survivorCount)
  }
  
  sort() {
    this.species.sort((a, b) => b.score - a.score)
    
  }
  
  breed(type = 'equal') {
    this.species = []
    if(type == 'equal') {
      for(let i = 0; i < numBacteria; i++) {
        //console.log(i % this.survivorCount)
        let newBacteria = this.speciesTemp[i % this.survivorCount].copy()
        // newBacteria.blank()
        // newBacteria.copyBrainFrom(this.speciesTemp[i % this.survivorCount])
        // newBacteria.copyBodyFrom(this.speciesTemp[i % this.survivorCount])
        // newBacteria.copyDataFrom(this.speciesTemp[i % this.survivorCount])
        this.species.push(newBacteria)
      }
    }
  }

  nextGen = () => {
    this.rank()
    this.getLastScore()
    PAUSED = false
    GEN++
    console.log(this.score)
    this.saveGen()
    //this.killHalf()
    this.killPercent()
    this.breed()
    this.scores.push(this.score)
    CLOCK = 0
    ROUND_TIMER = 0
    FOOD_TIMER = 0
    
    this.species.score = this.score
    
    
    for(let i = 0; i < this.species.length; i++) {
      //console.log(this.species)
      this.species[i].mutate()
      this.species[i].gen += 1
      this.species[i].id = i
      this.species[i].body.refill()
      this.species[i].foodsConsumed = 0
    }
    this.petriDish.reset()

    //bestBrains = this.lastScore()
  }

  metabolism = () => {
    ENERGY_TIMER += 1
    if(ENERGY_TIMER > ENERGY_TIME) {
      ENERGY_TIMER = 0
      for(let i = 0; i < this.species.length; i++) {
        if(this.species[i].alive) {
          this.species[i].body.energy--
          
          if(this.species[i].body.energy < 1) {
            this.species[i].body.HP -= this.species[i].body.hungerCost
            this.species[i].body.energy = 0
          }
  
          if(this.species[i].body.HP < 1) {
            this.species[i].timeAlive = CLOCK
            this.species[i].body.HP = 0
            this.species[i].alive = false
          }
        }
      }
    }
  }

  inputReady = () => {
    let dataRows = this.sensorGrid.length
    let dataCols = this.sensorGrid[0].length
    
    this.inputData = []

    for(let i = 0; i < this.speciesSensoryData.length; i++) {
      
      let data = this.speciesSensoryData[i]

      let inputReady = []

      //transcribe Vision data
      for(let v = 0; v < 3; v++) {
        let visionField = data[0][v]

        if(visionField == 'e') {
          inputReady.push(0, 0)
        } else if (visionField == 'w' || visionField == 0) {
          inputReady.push(0, 1)
        } else if (visionField == 'f') {
          inputReady.push(1, 1)
        } else {
          inputReady.push(1, 0)
        }
      }
      
      for (let x = 0; x < dataRows; x++) {
        for (let y = 0; y < dataCols - 1; y++) {

            let touchX = x
            let touchY = y + 1

            // skip center, bottom right and bottom left
            if(touchX == 1 && touchY == 1 || touchX == 0 && touchY == 2 || touchX == 2 && touchY == 2){

          } else {
            //console.log(touchX, touchY)
            let touchField = data[touchY][touchX]
            
            //console.log(touchX, touchY)

            if(!(touchField === 'e')) {
              inputReady.push(0)
            } else {
              inputReady.push(1)
            }
          }
        }
      }
      this.inputData.push(inputReady)
    }
  }

  roundLoop = () => {
    if(ROUND_TIMER < ROUND_TIME) {
      PAUSED = false
      this.getSensoryData()
      this.inputReady()
      this.feedInputs()
      this.metabolism()

      for(let i = 0; i < numBacteria; i++) {
  
        this.species[i].brain.fire()
      } 

      ROUND_TIMER ++
    } else {
      //PAUSED = true 
      for(let i = 0; i < numBacteria; i++) {
  
      this.species[i].timeAlive ? this.species[i].timeAlive : CLOCK
      } 

      this.nextGen()
    }
  }
      
    
  

  feedInputs = () => {
    //console.log(this.inputData.length)

    
    for(let i = 0; i < this.inputData.length; i++) {
      //let inputs = this.species
      _inputData = this.inputData 
      //console.log(_inputData)
      this.species[i].brain.feedInput(_inputData[i])
    }
  }

  act = () => {
    for(let i = 0; i < this.species.length; i++) {
      this.species[i].act()
    }

  }

  init = () => {
    for(let i = 0; i < numBacteria; i++) {
      this.species.push(new Bacteria())
      this.species[i].init()
      this.species[i].id = i
    }
  }
  
  getLastScore = () => {
    let top = []

    //for(let i = 0; i < this.species.length; i++) {
      //top.push(this.gens[this.gens.length-1][i])
      this.lastScore =  deepCopy(this.score)
    //}
  }

  getBest = () => {
    best = this.score[0][0]
  }

  update = () => {
    this.getSensoryData()
    this.inputReady()
    this.feedInputs()
    this.metabolism()
    //console.log(this.inputData)
    for(let i = 0; i < numBacteria; i++) {
      //  this.species[i].brain.inputNoise()
      //this.species[i].brain.outputNoise()
      this.species[i].brain.fire()
      this.species[i].oldX = this.species[i].x
      this.species[i].oldY = this.species[i].y
    }
  }

  render = () => {
    for(let i = 0; i < numBacteria; i++) {
      renderBrain(this.species[i].brain, i * 100, SIZE - 100, 100)
    }
  }  
}

let petri = new petriDish()
petri.emptyRoom()
petri.dropFood()


let allBacteria = []

let manager = new SpeciesManager()
manager.init()
manager.linkPetriDish(petri)

petri.linkManager(manager)
petri.getOrganismData(manager.species)
petri.placeBacteria()
petri.extractColors()

let bacteria = new Bacteria();
bacteria.init()

let best = 0

function renderUI() {
  //renderBrain(bacteria.brain, 0, 0, 600)


  if(false) {
    lastGenScore()

    //console.log(best, manager.lastScore[1][0])
    renderBrain(manager.species[best].brain, 680, 30, SIZE)
    //renderBrain(manager.species[manager.lastScore[1][0]].brain, 30, 670, 120)
    //renderBrain(manager.species[manager.lastScore[2][0]].brain, 200, 670, 120)
    //renderBrain(manager.species[manager.lastScore[3][0]].brain, 370, 670, 120)
  } else {
  lastGenScore()
  renderBrain(manager.species[0].brain, 30, 670, 120)
  renderBrain(manager.species[1].brain, 200, 670, 120)
  renderBrain(manager.species[2].brain, 370, 670, 120)
  renderBrain(manager.species[0].brain, 680, 30, SIZE)
  }
  ctx.font = "30px Arial";
    ctx.fillStyle = 'white'

    ctx.fillText(`GEN: ${GEN}`, 1200, 800);
}






// Set the desired TPS and calculate the tick interval

const tickInterval = 1000 / TPS;

// Set the maximum FPS
const maxFPS = 60;


let elapsedTime = 0;
let lastTickTime = Date.now();

function update() {
  //console.log("Updating game state");
  
  manager.roundLoop()
  petri.moveBacteria()

  TICK = (TICK + 1 ) % TPS

  FOOD_TIMER += 1
  if(FOOD_TIMER < FOOD_TIME) {
  } else {
    petri.dropFood()
    FOOD_TIMER = 0
  }
}


function render() {

  ctx.fillStyle = 'black'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  renderUI()
  debugBrain(bacteria.brain)
  petri.render()
  //manager.render()
  ctx.font = "10px Arial";
  ctx.fillStyle = 'white'
  
  ctx.fillText(`${~~(CLOCK/TPS)}`, 10, 10)
 
}

function gameLoop() {
  if(!PAUSED) {
    // Calculate the elapsed time since the last game loop iteration
    elapsedTime += Date.now() - lastTickTime;
    lastTickTime = Date.now();

    while (elapsedTime >= tickInterval) {
      update();
      CLOCK ++
    
      elapsedTime -= tickInterval;
    }

    if (Date.now() - lastTickTime < 1000 / maxFPS) {
      render();
    }
      requestAnimationFrame(gameLoop);
  }
}

gameLoop()