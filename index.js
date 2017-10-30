"use strict"

const libp2p = require("libp2p")
const TCP = require("libp2p-tcp")
const WS = require("libp2p-websockets")
const Peer = require("peer-info")
const Id = require("peer-id")
const multiaddr = require("multiaddr")

const SPDY = require('libp2p-spdy')
const MULTIPLEX = require('libp2p-multiplex')
const SECIO = require('libp2p-secio')
const listen = ["/ip4/0.0.0.0/tcp/5284", "/ip6/::/tcp/5284"]

const {
  map
} = require("async")

const nodetrust = require("./src")

map(require("./test/ids.json"), Id.createFromJSON, (e, ids) => {
  if (e) throw e
  const peer = new Peer(ids[1])

  listen.forEach(addr => peer.multiaddrs.add(addr))

  let tcp = new TCP()
  let ws = new WS()
  let l = []
  const create = tcp.createListener.bind(tcp)
  tcp.createListener = (options, handler) => {
    let n = create(options, handler)
    n.handler = handler || options
    l.push(n)
    return n
  }

  const swarm = new libp2p({
    transport: [
      tcp
    ],
    connection: {
      muxer: [
        MULTIPLEX,
        SPDY
      ],
      crypto: [SECIO]
    }
  }, peer)

  const node = new Peer(ids[0])
  node.multiaddrs.add("/ip4/127.0.0.1/tcp/4001/ipfs/" + ids[0].toB58String())

  new nodetrust(swarm, {
    node
  })

  swarm.start(err => {
    if (err) throw err
    swarm.nodetrust.enable(err => {
      if (err) throw err
      let wss = ws.createListener({
        cert: swarm.nodetrust.chain,
        key: swarm.nodetrust.key
      }, l[0].handler)
      wss.listen(multiaddr("/ip4/0.0.0.0/tcp/5285/ws"), err => {
        if (err) throw err
        console.log("Online @ https://localhost:5285")
      })
    })
  })
})
