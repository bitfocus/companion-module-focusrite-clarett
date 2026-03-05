/**
 * Focusrite Clarett Variables
 *
 * Exposed variables for use in button text and triggers
 */

export function updateVariables(self) {
	self.setVariableDefinitions({
		// Device info
		device_name: { name: 'Device Name' },
		device_model: { name: 'Device Model' },
		connection_status: { name: 'Connection Status' },

		// Input mutes
		input_1_mute: { name: 'Input 1 Mute' },
		input_2_mute: { name: 'Input 2 Mute' },
		input_3_mute: { name: 'Input 3 Mute' },
		input_4_mute: { name: 'Input 4 Mute' },
		input_5_mute: { name: 'Input 5 Mute' },
		input_6_mute: { name: 'Input 6 Mute' },
		input_7_mute: { name: 'Input 7 Mute' },
		input_8_mute: { name: 'Input 8 Mute' },

		// Air mode
		input_1_air: { name: 'Input 1 Air' },
		input_2_air: { name: 'Input 2 Air' },
		input_3_air: { name: 'Input 3 Air' },
		input_4_air: { name: 'Input 4 Air' },
		input_5_air: { name: 'Input 5 Air' },
		input_6_air: { name: 'Input 6 Air' },
		input_7_air: { name: 'Input 7 Air' },
		input_8_air: { name: 'Input 8 Air' },

		// Input mode (Mic/Line/Inst)
		input_1_mode: { name: 'Input 1 Mode' },
		input_2_mode: { name: 'Input 2 Mode' },
		input_3_mode: { name: 'Input 3 Mode' },
		input_4_mode: { name: 'Input 4 Mode' },
		input_5_mode: { name: 'Input 5 Mode' },
		input_6_mode: { name: 'Input 6 Mode' },
		input_7_mode: { name: 'Input 7 Mode' },
		input_8_mode: { name: 'Input 8 Mode' },

		// Output volumes
		output_1_volume: { name: 'Output 1 Volume' },
		output_2_volume: { name: 'Output 2 Volume' },
		output_3_volume: { name: 'Output 3 Volume' },
		output_4_volume: { name: 'Output 4 Volume' },
		output_5_volume: { name: 'Output 5 Volume' },
		output_6_volume: { name: 'Output 6 Volume' },
		output_7_volume: { name: 'Output 7 Volume' },
		output_8_volume: { name: 'Output 8 Volume' },
		output_9_volume: { name: 'Output 9 Volume' },
		output_10_volume: { name: 'Output 10 Volume' },

		// Monitor controls
		monitor_dim: { name: 'Monitor Dim' },
		talkback: { name: 'Talkback' },
	})

	// Set initial values
	self.setVariableValues({
		device_name: self.deviceInfo?.name || 'Not connected',
		device_model: self.deviceInfo?.model || '',
		connection_status: self.client?.connected ? 'Connected' : 'Disconnected',
	})
}
