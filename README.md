# companion-module-focusrite-clarett

[Bitfocus Companion](https://bitfocus.io/companion) module for controlling **Focusrite Clarett** audio interfaces.

> **Important:** This module does **not** communicate directly with the audio interface hardware. Instead it connects to **FocusriteControlServer** — a background service that is installed as part of Focusrite's driver/software package and runs on the same computer the interface is connected to. Companion sends TCP/XML commands to that service, which in turn controls the hardware.

## Supported Devices

- Clarett 2Pre / Clarett+ 2Pre
- Clarett 4Pre / Clarett+ 4Pre
- Clarett 8Pre / Clarett+ 8Pre
- Clarett 8PreX

## Requirements

- **Focusrite Control** (the official Focusrite software) must be **installed** on the computer the interface is connected to — it does not need to be open
- **FocusriteControlServer** — installed automatically alongside Focusrite Control and runs as a background service/daemon on that computer (port 49152)
- The Clarett interface must be connected to **that same computer** via USB or Thunderbolt
- Companion can run on the **same computer** or on a **different computer** on the same network

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/bitfocus/companion-module-focusrite-clarett.git
   ```
2. Install dependencies:
   ```bash
   yarn install
   ```
3. In Companion, go to **Settings** → **Developer modules** → **Add** and select the cloned folder
4. Add the module as a new connection

## Configuration

| Setting | Default | Description |
|---|---|---|
| Server Host | `127.0.0.1` | IP address or hostname of the computer running FocusriteControlServer |
| Server Port | `49152` | TCP port of FocusriteControlServer (rarely needs changing) |

If Companion runs on the **same machine** as the Clarett interface, leave the host as `127.0.0.1`. If Companion runs on a **separate machine** (e.g. a dedicated show-control PC), enter the IP address of the computer the interface is connected to. Note that FocusriteControlServer listens on all interfaces by default, so remote connections should work as long as the firewall allows port 49152.

### First-time Approval

On first connect, Focusrite Control will ask to approve the "Companion-Focusrite" client:

1. Open **Focusrite Control**
2. A popup will appear — click **Approve**

This only needs to be done once.

## Actions

### Input / Mixer
| Action | Description |
|---|---|
| **Mute Input** | Mute/unmute a mixer input on a specific mix bus |
| **Solo Input** | Solo/unsolo a mixer input |
| **Set Fader** | Set mixer fader level (dB, −128 to +6) |
| **Set Pan** | Set pan position (−100 to +100) |

### Hardware Controls
| Action | Description |
|---|---|
| **Air Mode** | Toggle/on/off Focusrite Air mode |
| **Input Mode** | Set Mic / Line / Instrument mode |
| **Cycle Input Mode** | Step through available modes |
| **Stereo Link** | Toggle stereo linking of adjacent inputs |

> **Note:** Phantom power (48V), pad, HPF, phase invert and input gain are hardware-locked on the Clarett 8PreX and cannot be controlled via software.

### Output / Monitor
| Action | Description |
|---|---|
| **Mute Output** | Mute/unmute a line output |
| **Set Output Volume** | Set output level (dB, −128 to +6) |
| **Dim Monitor** | Toggle dim on the monitor output (Out 1-2) |
| **Talkback** | Activate talkback (requires item ID) |

### Advanced
| Action | Description |
|---|---|
| **Set Raw Value** | Send any value by numeric item ID |
| **Toggle Raw Value** | Toggle any boolean control by item ID |

## Feedbacks

All controls have boolean feedback for button styling:

| Feedback | Color |
|---|---|
| Input Muted | 🔴 Red |
| Input Soloed | 🟡 Yellow |
| Air Mode Enabled | 🟡 Yellow |
| Dim Enabled | 🟠 Dark orange |
| Talkback Enabled | 🟢 Green |
| Stereo Linked | 🟢 Dark green |
| Mode is Mic / Line / Inst | Red / Dark red / Pink |
| Value Equals (advanced) | Custom |

## Presets

Ready-to-use button presets are included for channels 1–8:

- Input mutes
- Input solos
- Air mode
- Input mode (cycles Mic → Line → Inst)
- Dim (monitor output)
- Talkback (momentary)

## Variables

| Variable | Description |
|---|---|
| `device_name` | Connected device name |
| `device_model` | Device model string |
| `connection_status` | Connected / Disconnected |
| `input_1_air` … `input_8_air` | Air mode state per channel |
| `input_1_mode` … `input_8_mode` | Input mode (Mic/Line/Inst) |
| `input_1_mute` … `input_8_mute` | Mixer mute state per channel |
| `output_1_volume` … `output_10_volume` | Output volume value |
| `monitor_dim` | Monitor dim state |

## Protocol

This module communicates with **FocusriteControlServer** — a background service installed as part of Focusrite's driver package — over a **TCP socket on port 49152**. It does **not** send commands directly to the audio hardware.

```
Companion  ──TCP/XML──▶  FocusriteControlServer  ──driver──▶  Clarett interface
                         (runs on the audio host)
```

Message format: `Length=XXXXXX <xml-content>`  
*(6-digit uppercase hex length prefix, followed by a space, then the XML payload)*

Protocol details were reverse-engineered via packet capture of traffic between the Focusrite Control application and FocusriteControlServer.

## Acknowledgments

- **Linus Wileryd** — [GitHub](https://github.com/lnswlrd)
  Module development, protocol research via packet capture, device structure analysis and the XML schema including mixes, inputs, outputs and hardware controls

- **Focusrite Midi Control** by Radu Varga — [GitHub](https://github.com/raduvarga/Focusrite-Midi-Control)
  TCP message format, client-key requirement, keep-alive mechanism, device subscription flow

- **Focusrite Control API** by Mathieu2301 — [GitHub](https://github.com/Mathieu2301/Focusrite-Control-API)  
  XML command structure, device discovery format

## License

MIT — see [LICENSE](LICENSE)
