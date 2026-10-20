# Focusrite Clarett / Scarlett Module

Control your Focusrite Clarett or Scarlett audio interface directly from Companion without using Focusrite Control's GUI.

Both families expose the same control schema through FocusriteControlServer, so the same actions work for either. Which controls are available depends on the model: the module only offers what the connected device reports.

4th generation Scarlett interfaces are managed by Focusrite Control 2, which uses a different protocol, and are not supported.

## Requirements

- **Focusrite Control** software must be installed (but does not need to be running)
- **FocusriteControlServer** service must be running (it starts automatically on macOS and Windows)
- Interface connected to that same computer via Thunderbolt or USB

## Setup

1. Add the module in Companion
2. Set **Server Host**, or leave it at `127.0.0.1` when Companion runs on the same computer as the interface. Leave **Auto-detect port** on
3. **Important:** When you first connect, you need to approve the connection in Focusrite Control:
   - Open Focusrite Control
   - A popup will appear asking to approve "Companion-Focusrite"
   - Click "Approve"

## Actions

### Input Controls

- **Mute Input** - Mute/unmute mixer inputs (1-18)
- **Solo Input** - Solo/unsolo mixer inputs
- **Set Input Gain** - Set preamp gain (0-65535)
- **Set Fader** - Set mixer fader level for a specific mix bus
- **Set Pan** - Set pan position (-100 to 100)

### Hardware Controls

- **Air Mode** - Enable/disable Focusrite Air mode
- **Pad (-10dB)** - Enable/disable the input pad
- **Input Mode** - Set the input mode, where the device offers a choice
- **Cycle Input Mode** - Step through the available modes
- **Stereo Link** - Link adjacent inputs as stereo pair

Which of these your device offers varies, often between inputs on the same
device. An action warns instead of acting when the control is not there.

### Output Controls

- **Mute Output** - Mute/unmute outputs. Linked stereo pairs are listed as one pair, and unlinked channels individually, matching the STEREO setting in Focusrite Control
- **Set Output Volume** - Set output level (0-65535)

### Monitor Controls

- **Dim Output** - Toggle dim mode
- **Talkback** - Activate talkback (momentary or toggle)

### Advanced

- **Set Raw Value** - Send any control value by item ID
- **Toggle Raw Value** - Toggle any boolean control

## Feedbacks

All boolean controls have corresponding feedbacks for button states:

- Input Muted (red)
- Input Soloed (yellow)
- Air Mode Enabled (yellow)
- Pad Enabled (blue)
- Mode is Mic / Line / Inst (red / dark red / pink)
- Dim Enabled (dark orange)
- Talkback Enabled (green)
- Stereo Linked (dark green)
- Output Muted (red)
- Value Equals, for any control by item ID

## Presets

Presets are built from what your device reports, so you only get buttons that
do something, and the channel counts match the device rather than a fixed eight:

- Input mutes, one per mixer input that has a mute
- Input solos, one per mixer input that has a solo
- Air mode, one per input that has Air
- Pad, one per input that has a pad
- Input mode, only on devices with switchable Mic/Line/Inst inputs
- Dim, when the device has a monitoring section

If a group would be empty it is left out. Many interfaces control their preamps
from the front panel and report no Air or input mode at all, so seeing fewer
groups than you expected usually reflects the hardware rather than a fault.

Talkback has no preset: the action needs an item ID that differs between
devices. Add the action manually and supply the ID.

## Variables

The module exposes variables for:

- Device nickname, model, family and serial number
- Connection status
- Input gains and states
- Output volumes
- Monitor states

## Troubleshooting

### "Waiting for approval..."

Open Focusrite Control and approve the Companion connection.

### "Connection refused" or no server found

FocusriteControlServer does not use a fixed port. It takes an OS-assigned port from the ephemeral range starting at `49152`, and takes a different one each time the service restarts, which is why a hard-coded port is unreliable. With **Auto-detect port** on, the module finds it for you and searches again if the port stops answering.

If it still cannot connect, check the service is actually running.

On Windows:

```bash
sc query "Focusrite Control Server"
```

On macOS or Linux:

```bash
ps aux | grep -i focusrite
```

When Companion runs on a different computer from the interface, also check that the host is reachable and the firewall allows the connection. Auto-detect has to probe a range of ports, so a firewall that silently drops packets will make it slow; pin the port instead in that case.

### Wrong device picked up

With several interfaces connected, the module uses the first supported one. The `device_model`, `device_class` and `device_serial` variables show which one it bound to.

### Controls not working

The item IDs differ between models. Use the "Set Raw Value" action with debug logging to discover the correct IDs for your device.

## Protocol

This module communicates with the FocusriteControlServer using TCP/XML protocol:

- **Port:** assigned from the ephemeral range, discovered automatically (can be pinned)
- **Message format:** `Length=XXXXXX <xml-content>` (Length PREFIX with space)

## Acknowledgments

- **Linus Wileryd** — [github.com/lnswlrd](https://github.com/lnswlrd)  
  Module development, protocol research via packet capture, device structure analysis and the XML schema including mixes, inputs, outputs and hardware controls

- **Focusrite Midi Control** by Radu Varga — [GitHub](https://github.com/raduvarga/Focusrite-Midi-Control)  
  TCP message format, client-key requirement, keep-alive mechanism, device subscription flow

- **Focusrite Control API** by Mathieu2301 — [GitHub](https://github.com/Mathieu2301/Focusrite-Control-API)  
  XML command structure, device discovery format
