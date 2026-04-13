# Calcite Debugger Quick Reference

Full documentation: `../calcite/docs/debugger.md`

## Starting

```sh
cargo run --release -p calcite-debugger -- -i path/to/program.css
# Listens on port 3333 (change with -p PORT)
```

## Key endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /tick {"count":N}` | Advance N ticks |
| `POST /seek {"tick":N}` | Jump to tick N (uses checkpoints) |
| `GET /state` | All registers + computed properties |
| `POST /memory {"addr":N,"len":N}` | Hex dump of memory region |
| `POST /screen` | Render VGA text buffer |
| `GET /compare-paths` | Diff compiled vs interpreted at current tick |
| `POST /trace-property {"property":"--memAddr"}` | Trace compiled execution of a property |
| `POST /dump-ops {"start":N,"end":M}` | Dump raw compiled ops in range |
| `POST /keyboard {"value":N}` | Set keyboard CSS property |
| `POST /shutdown` | Stop the server |

## Typical workflow

```sh
# Step to the diverging tick
curl -X POST localhost:3333/seek -d '{"tick":3740}'

# Check compiled vs interpreted
curl -s localhost:3333/compare-paths | python3 -m json.tool

# If they disagree, trace the diverging property
curl -X POST localhost:3333/trace-property -d '{"property":"--memAddr"}'

# Inspect memory around the problem
curl -X POST localhost:3333/memory -d '{"addr":1024,"len":64}'
```
