# companion-module-focusrite-clarett

[Bitfocus Companion](https://bitfocus.io/companion) module for controlling **Focusrite Clarett** and **Focusrite Scarlett** audio interfaces.

> **Important:** This module does **not** communicate directly with the audio interface hardware. Instead it connects to **FocusriteControlServer** — a background service that is installed as part of Focusrite's driver/software package and runs on the same computer the interface is connected to. Companion sends TCP/XML commands to that service, which in turn controls the hardware.

## Supported Devices

Clarett and Scarlett interfaces expose the same control schema through FocusriteControlServer, so both families are driven by the same code.

**Clarett**

- Clarett 2Pre / Clarett+ 2Pre
- Clarett 4Pre / Clarett+ 4Pre
- Clarett 8Pre / Clarett+ 8Pre
- Clarett 8PreX

**Scarlett** (models managed by Focusrite Control, i.e. 2nd and 3rd generation)

- Scarlett 18i20 / 18i8 / 18i6
- Scarlett 8i6 / 6i6 / 4i4 / 2i2

Available controls depend on what the interface itself offers. A device that has no Air or no Instrument mode simply will not expose those items, and the module only builds actions for the items the device reports.

> **Note:** 4th generation Scarlett interfaces are managed by Focusrite Control 2, which does not use the FocusriteControlServer protocol. They are not supported.

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

| Setting          | Default     | Description                                                                                       |
| ---------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| Server Host      | `127.0.0.1` | IP address or hostname of the computer running FocusriteControlServer                             |
| Auto-detect port | on          | Find FocusriteControlServer automatically. Leave this on unless you have a reason to pin the port |
| Server Port      | `49152`     | Starting guess when auto-detect is on, and the exact port used when it is off                     |

If Companion runs on the **same machine** as the Clarett interface, leave the host as `127.0.0.1`. If Companion runs on a **separate machine** (e.g. a dedicated show-control PC), enter the IP address of the computer the interface is connected to. Note that FocusriteControlServer listens on all interfaces by default, so remote connections should work as long as the firewall allows port 49152.

### About the port

FocusriteControlServer does **not** listen on a fixed port. It takes an OS-assigned port from the ephemeral range, which starts at `49152`, and it takes a different one each time the service restarts. The value `49152` that older documentation quotes is just the bottom of that range, so it is only correct when the server happens to win the first slot.

Focusrite's own applications locate the server dynamically, and so does this module. On connect it probes the ephemeral range and keeps the first listener that answers the FocusriteControlServer protocol, remembering that port so later starts cost a single probe rather than a scan. If the port stops responding, which is what a service restart looks like, the module searches again rather than retrying a dead port.

The probe sends a bare `<keep-alive/>`, which the server echoes back. That carries no client identity, so scanning never registers a client or raises an approval prompt.

Turn **Auto-detect port** off only if you want to pin an exact port, for example when reaching the server through a NAT or SSH tunnel that maps it to something fixed.

### First-time Approval

On first connect, Focusrite Control will ask to approve the "Companion-Focusrite" client:

1. Open **Focusrite Control**
2. A popup will appear — click **Approve**

This only needs to be done once.

## Actions

### Input / Mixer

| Action         | Description                                     |
| -------------- | ----------------------------------------------- |
| **Mute Input** | Mute/unmute a mixer input on a specific mix bus |
| **Solo Input** | Solo/unsolo a mixer input                       |
| **Set Fader**  | Set mixer fader level (dB, −128 to +6)          |
| **Set Pan**    | Set pan position (−100 to +100)                 |

### Hardware Controls

| Action               | Description                              |
| -------------------- | ---------------------------------------- |
| **Air Mode**         | Toggle/on/off Focusrite Air mode         |
| **Pad (-10dB)**      | Toggle/on/off the input pad              |
| **Input Mode**       | Set Mic / Line / Instrument mode         |
| **Cycle Input Mode** | Step through available modes             |
| **Stereo Link**      | Toggle stereo linking of adjacent inputs |

> **Note:** Which of these a device offers varies widely, often within one device. A Scarlett 18i8 (3rd Gen) reports Air and pad on its four preamps but input mode on only two of them, while a Clarett 8PreX controls its preamps in hardware and offers none. Actions warn rather than acting when the control is absent, and presets are only generated for controls the device reports.
>
> Phantom power (48V), high pass filter and phase invert are recognised by the protocol parser but have no actions yet, because no device tested so far reports them.

### Output / Monitor

| Action                | Description                                |
| --------------------- | ------------------------------------------ |
| **Mute Output**       | Mute/unmute a line output                  |
| **Set Output Volume** | Set output level (dB, −128 to +6)          |
| **Dim Monitor**       | Toggle dim on the monitor output (Out 1-2) |
| **Talkback**          | Activate talkback (requires item ID)       |

Output actions follow the STEREO setting in Focusrite Control. While a pair is linked it is listed and controlled as one, for example `Line Outputs 3-4`, because the device only accepts changes through the left channel. While unlinked, each channel is listed and controlled on its own. Toggling STEREO updates the list without a reconnect.

### Advanced

| Action               | Description                           |
| -------------------- | ------------------------------------- |
| **Set Raw Value**    | Send any value by numeric item ID     |
| **Toggle Raw Value** | Toggle any boolean control by item ID |

## Feedbacks

All controls have boolean feedback for button styling:

| Feedback                  | Color                 |
| ------------------------- | --------------------- |
| Input Muted               | 🔴 Red                |
| Input Soloed              | 🟡 Yellow             |
| Air Mode Enabled          | 🟡 Yellow             |
| Pad Enabled               | 🔵 Blue               |
| Dim Enabled               | 🟠 Dark orange        |
| Talkback Enabled          | 🟢 Green              |
| Stereo Linked             | 🟢 Dark green         |
| Mode is Mic / Line / Inst | Red / Dark red / Pink |
| Value Equals (advanced)   | Custom                |

## Presets

Presets are generated from what the connected device reports, so you are only
offered buttons that do something on your interface. Channel counts follow the
device rather than a fixed eight.

| Preset                                | Offered when                                  |
| ------------------------------------- | --------------------------------------------- |
| Input mutes                           | the first mix has inputs with a mute control  |
| Input solos                           | the first mix has inputs with a solo control  |
| Air mode                              | the device reports an Air control on an input |
| Pad                                   | the device reports a pad control on an input  |
| Input mode (cycles Mic → Line → Inst) | the device reports a mode control on an input |
| Dim                                   | the device has a monitoring section with dim  |

A group that would be empty is left out entirely, and a control present on only
some inputs produces buttons for just those channels. A Scarlett 18i8 (3rd Gen)
reports Air and pad on four inputs and mode on two, so it yields four Air, four
pad and two mode buttons. A Scarlett 18i20 (2nd Gen) controls its preamps from
the front panel and gets none of them, while its mixer yields eighteen mute and
eighteen solo buttons.

Talkback has no preset because the action needs an item ID that varies per
device and cannot be guessed. Add it as an action and supply the ID.

## Variables

| Variable                               | Description                                                            |
| -------------------------------------- | ---------------------------------------------------------------------- |
| `device_name`                          | Device nickname as set in Focusrite Control, falling back to the model |
| `device_model`                         | Device model string, e.g. `Scarlett 18i20 (2nd Gen)`                   |
| `device_class`                         | Device family, `Clarett` or `Scarlett`                                 |
| `device_serial`                        | Device serial number                                                   |
| `connection_status`                    | Connected / Disconnected                                               |
| `input_1_air` … `input_8_air`          | Air mode state per channel                                             |
| `input_1_mode` … `input_8_mode`        | Input mode (Mic/Line/Inst)                                             |
| `input_1_mute` … `input_8_mute`        | Mixer mute state per channel                                           |
| `output_1_volume` … `output_10_volume` | Output volume value                                                    |
| `monitor_dim`                          | Monitor dim state                                                      |

## Protocol

This module communicates with **FocusriteControlServer** — a background service installed as part of Focusrite's driver package — over a **TCP socket on a port taken from the ephemeral range** (see [About the port](#about-the-port)). It does **not** send commands directly to the audio hardware.

```
Companion  ──TCP/XML──▶  FocusriteControlServer  ──driver──▶  Clarett / Scarlett
                         (runs on the audio host)                   interface
```

Message format: `Length=XXXXXX <xml-content>`  
_(6-digit uppercase hex length prefix, followed by a space, then the XML payload)_

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
