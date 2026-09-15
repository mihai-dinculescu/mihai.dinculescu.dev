+++
title = "ESP32 MQTT Publish with Rust"
date = 2022-02-04
description = "Publishing MQTT messages from an ESP32 in Rust with the existing libraries, while the ESP-IDF MQTT client wrapper is still in the works."

[taxonomies]
tags = ["rust", "esp32", "mqtt", "embedded"]

[extra]
comment = true
read_time = true
canonical_url = "https://medium.com/iotics/esp32-mqtt-publish-with-rust-678d1068ee2"
+++

> Originally published on the
> [IOTICS blog](https://medium.com/iotics/esp32-mqtt-publish-with-rust-678d1068ee2).
> The Rust on ESP32 ecosystem has moved a lot since, so expect the crate
> versions and APIs below to be out of date.

Here at [IOTICS](https://iotics.com), we are in the habit of concocting various
fun, weird and sometimes practical use-cases with microcontrollers and seeing
how they integrate with our [technology](https://iotics.com/architecture/).
Recently we've been combining this with our love of Rust, and because the
ecosystem is in its early days, we thought it might prove helpful to its growth
to share parts of our journey.

While the folks at <https://github.com/esp-rs/esp-idf-svc> are working hard on
wrapping ESP-IDF's MQTT Client, here's a way to publish to MQTT today, using
existing libraries.

## Prerequisites

Follow
[Ivan Markov's brilliant guide](https://github.com/ivmarkov/rust-esp32-std-demo#build)
on installing the required toolchain and all the other prerequisites for your
board. It worked well for me, and I'm sure it will work great for you too!

## Project Setup

Note: I'll only consider ESP32 in this guide to keep this section short. For
ESP32-S2 or ESP32-S3, please browse
[Ivan Markov's guide](https://github.com/ivmarkov/rust-esp32-std-demo#build).
You would have to change the `target` in `.cargo/config.toml`, tweak
`build.rs`, and possibly leverage some of the flags used in the `defaults`
files.

```rust
// build.rs

use embuild::build::LinkArgs;

fn main() -> anyhow::Result<()> {
    // Necessary because of this issue: https://github.com/rust-lang/cargo/issues/9641
    LinkArgs::output_propagated("ESP_IDF")?;

    Ok(())
}
```

```toml
# .cargo/config.toml

[build]
target = "xtensa-esp32-espidf"

[target.xtensa-esp32-espidf]
linker = "ldproxy"

[unstable]
build-std = ["std", "panic_abort"]
build-std-features = ["panic_immediate_abort"]
```

```toml
# Cargo.toml

[package]
name = "esp32_mqtt_publish"
version = "0.1.0"
edition = "2021"

[profile.release]
opt-level = "s" # Optimize for size

[profile.dev]
debug = true # Symbols are nice and they don't increase the size on Flash
opt-level = "z"

[dependencies]
# rust crates
anyhow = { version = "1.0", features = ["backtrace"] }
log = "0.4"

# ESP32 crates
esp-idf-svc = "0.36"
esp-idf-sys = { version = "0.30", features = ["binstart", "native"] } # `native` uses ESP-IDF instead of PlatformIO

[build-dependencies]
anyhow = "1.0"
embuild = "0.28"
```

I would like to draw your attention to the following from `Cargo.toml`:

- `opt-level = "s"` is required for the compiled code to fit an ESP32. It
  instructs the `rustc` compiler to optimize for size. `s` is small enough,
  while `z` is
  [supposed to](https://docs.rust-embedded.org/book/unsorted/speed-vs-size.html#optimize-for-size)
  produce the smallest output.
- the `native` feature of [esp-idf-sys](https://github.com/esp-rs/esp-idf-sys)
  makes it utilize the `esp-idf` tooling over
  [Platform IO](https://platformio.org/). It is experimental, but it has worked
  nicely for me so far.

```rust
// main.rs

use log::info;

use esp_idf_svc::log::EspLogger;

static LOGGER: EspLogger = EspLogger;

fn main() -> anyhow::Result<()> {
    esp_idf_sys::link_patches();

    log::set_logger(&LOGGER).map(|()| LOGGER.initialize())?;
    LOGGER.set_target_level("", log::LevelFilter::Info);

    info!("Hello World! I'm a Rustacean!");

    Ok(())
}
```

While [esp_idf_svc](https://github.com/esp-rs/esp-idf-svc) does
[include a logger instance](https://github.com/esp-rs/esp-idf-svc/blob/master/src/log.rs),
currently, there is no API to allow us to change the logging level to `info`.
For this reason, we have to create our static logger instance.

## Running the code

Install [espflash](https://github.com/esp-rs/espflash) and
[espmonitor](https://github.com/esp-rs/espmonitor) if you haven't done it
already.

```sh
cargo install cargo-espflash
cargo install cargo-espmonitor
```

You can find out which serial port is your ESP32 connected to by running:

```sh
espflash board-info
```

With all the pieces in place, let's compile the code and flash it onto the
ESP32.

```sh
cargo build
espflash <SERIAL-PORT> target/xtensa-esp32-espidf/debug/esp32_mqtt_publish
espmonitor <SERIAL-PORT>
```

Hopefully, everything goes fine, and the `Hello World! I'm a Rustacean!`
message will greet you, alongside plenty of debugging information.

If you're missing something which sounds related to the toolchain, you should
double-check that you haven't missed something from
[Ivan Markov's guide](https://github.com/ivmarkov/rust-esp32-std-demo#build).

## Wifi

Before we can even think of publishing messages to MQTT, we need to connect to
the Wifi.

```toml
# Cargo.toml

# ...

# ESP32 crates
embedded-svc = "0.16"
# ...
```

```rust
// main.rs

use anyhow::bail;
use log::info;
use std::sync::Arc;

use embedded_svc::wifi::*;
use esp_idf_svc::log::EspLogger;
use esp_idf_svc::netif::EspNetifStack;
use esp_idf_svc::nvs::EspDefaultNvs;
use esp_idf_svc::sysloop::EspSysLoopStack;
use esp_idf_svc::wifi::EspWifi;

static LOGGER: EspLogger = EspLogger;

// !!! SET THIS !!!
const WIFI_SSID: &str = "";
const WIFI_PASS: &str = "";

fn main() -> anyhow::Result<()> {
// ...
```

```rust
// main.rs

// ...

fn setup_wifi(
    netif_stack: Arc<EspNetifStack>,
    sys_loop_stack: Arc<EspSysLoopStack>,
    default_nvs: Arc<EspDefaultNvs>,
    ssid: &str,
    password: &str,
) -> anyhow::Result<Box<EspWifi>> {
    let mut wifi = Box::new(EspWifi::new(netif_stack, sys_loop_stack, default_nvs)?);

    wifi.set_configuration(&Configuration::Client(ClientConfiguration {
        ssid: ssid.into(),
        password: password.into(),
        ..Default::default()
    }))?;

    info!("Wifi configuration set, about to get status");

    let status = wifi.get_status();

    if let Status(
        ClientStatus::Started(ClientConnectionStatus::Connected(ClientIpStatus::Done(_))),
        _,
    ) = status
    {
        info!("Wifi connected");
    } else {
        bail!("Unexpected Wifi status: {:?}", status);
    }

    Ok(wifi)
}
```

```rust
// main.rs

// ...

fn main() -> anyhow::Result<()> {
    // ...

    let netif_stack = Arc::new(EspNetifStack::new()?);
    let sys_loop_stack = Arc::new(EspSysLoopStack::new()?);
    let default_nvs = Arc::new(EspDefaultNvs::new()?);

    let _wifi = setup_wifi(
        netif_stack,
        sys_loop_stack,
        default_nvs,
        WIFI_SSID,
        WIFI_PASS,
    )?;

    Ok(())
}

// ...
```

All that's left now is to flash the updated code and see if you've managed to
remember your Wifi password :)

```sh
cargo build
espflash <SERIAL-PORT> target/xtensa-esp32-espidf/debug/esp32_mqtt_publish
espmonitor <SERIAL-PORT>
```

If you remembered your Wifi credentials correctly, there would be two things
that might surprise you further.

Firstly, the logging output will increase considerably. It might take a few
seconds to locate the `Wifi connected` message.

Secondly, you might also notice that the Wifi gets stopped right after it
connects. Don't rush to restart your router; everything is fine! This happens
because the `_wifi` variable gets dropped by Rust at the end of the function.
On drop, everything required to establish the Wifi connection is cleaned up.

This is why the `setup_wifi` function returns the `wifi` instance. As long as
we want to use the Wifi connection, we'll have to keep this instance in scope.
`netif_stack`, `sys_loop_stack` and `default_nvs` will also need to be kept
around, but this is a given because the lifetime of `_wifi` depends on theirs.

## MQTT

We're finally ready to publish a message to MQTT.

```toml
# Cargo.toml

# ...

# rust crates
mqtt-protocol = "0.11"

# ...

# ESP32 crates
embedded-hal = "0.2"
esp-idf-hal = "0.32"

# ...
```

[mqtt-protocol](https://github.com/zonyitoo/mqtt-rs) is the first MQTT client
that I've found to work decently on an ESP32, but there could be others.

We also bring in `embedded-hal` and `esp-idf-hal` so that we can use a delay
provider.

```rust
// main.rs

use std::io::Write;
use std::net::TcpStream;

// ...

use mqtt::control::ConnectReturnCode;
use mqtt::packet::{ConnackPacket, ConnectPacket, PublishPacketRef, QoSWithPacketIdentifier};
use mqtt::{Decodable, Encodable, TopicName};

// ...

use embedded_hal::blocking::delay::DelayMs;
use esp_idf_hal::delay;

// ...

// !!! SET THIS !!!
const MQTT_ADDR: &str = ""; // host:port
const MQTT_CLIENT_ID: &str = "test_publish";
const MQTT_TOPIC_NAME: &str = "test_publish";

fn main() -> anyhow::Result<()> {
// ...
```

It quickly becomes evident that
[mqtt-protocol](https://github.com/zonyitoo/mqtt-rs) is a pretty low-level
library, and a lot is left up to the user. This suits us very well, though, as
it runs just fine on an ESP32 even if it wasn't built for it.

```rust
// main.rs

// ...

fn mqtt_connect(_: &EspWifi, mqtt_addr: &str, client_id: &str) -> anyhow::Result<TcpStream> {
    let mut stream = TcpStream::connect(mqtt_addr)?;

    let mut conn = ConnectPacket::new(client_id);
    conn.set_clean_session(true);
    let mut buf = Vec::new();
    conn.encode(&mut buf)?;
    stream.write_all(&buf[..])?;

    let conn_ack = ConnackPacket::decode(&mut stream)?;

    if conn_ack.connect_return_code() != ConnectReturnCode::ConnectionAccepted {
        bail!("MQTT failed to receive the connection accepted ack");
    }

    info!("MQTT connected");

    Ok(stream)
}
```

Here we have a connect function that takes an unused reference to an `EspWifi`
just to make sure that the caller doesn't try to call it without being
connected to the Wifi. We could even go the extra mile and double-check that
the Wifi is still connected, but I will leave this optimization up to you.

A `TcpStream` is created and connected to the given address before the
`ConnectPacket` is sent. If everything goes well and a `ConnackPacket` comes
back through the stream saying that the connection was accepted, we return the
`TcpStream` to the caller.

```rust
// main.rs

// ...

fn mqtt_publish(
    _: &EspWifi,
    stream: &mut TcpStream,
    topic_name: &str,
    message: &str,
    qos: QoSWithPacketIdentifier,
) -> anyhow::Result<()> {
    let topic = unsafe { TopicName::new_unchecked(topic_name.to_string()) };
    let bytes = message.as_bytes();

    let publish_packet = PublishPacketRef::new(&topic, qos, bytes);

    let mut buf = Vec::new();
    publish_packet.encode(&mut buf)?;
    stream.write_all(&buf[..])?;

    info!("MQTT published message {} to topic {}", message, topic_name);

    Ok(())
}
```

The `mqtt_publish` function does what you'd expect it to. It takes an unused
reference to an `EspWifi` and a mutable reference to a `TcpStream` through
which to publish the message.

The most interesting part here is `TopicName::new_unchecked`. If you would try
the safe version, `TopicName::new`, you will discover that your ESP32 will run
out of memory. This is caused by `TopicName::new` using
[regex](https://github.com/rust-lang/regex) behind the scenes, which is a bit
too heavy for an ESP32.

All that's left to do now is to go ahead and publish something.

{% raw %}
```rust
// main.rs

use std::io::Write;
use std::net::TcpStream;
use std::sync::Arc;

use anyhow::bail;
use log::info;
use mqtt::control::ConnectReturnCode;
use mqtt::packet::{ConnackPacket, ConnectPacket, PublishPacketRef, QoSWithPacketIdentifier};
use mqtt::{Decodable, Encodable, TopicName};

use embedded_hal::blocking::delay::DelayMs;
use embedded_svc::wifi::*;
use esp_idf_hal::delay;

// ...

// !!! SET THIS !!!
const MQTT_ADDR: &str = ""; // host:port
const MQTT_CLIENT_ID: &str = "test_publish";
const MQTT_TOPIC_NAME: &str = "test_publish";

fn main() -> anyhow::Result<()> {
    // ...

    let wifi = setup_wifi(
        netif_stack,
        sys_loop_stack,
        default_nvs,
        WIFI_SSID,
        WIFI_PASS,
    )?;

    let mut mqtt_stream = mqtt_connect(&wifi, MQTT_ADDR, MQTT_CLIENT_ID)?;

    loop {
        let mut delay = delay::FreeRtos;

        // mock a measurement
        let value = 21;

        let message = format!(r#"{{"measurement":{}}}"#, value);

        mqtt_publish(
            &wifi,
            &mut mqtt_stream,
            MQTT_TOPIC_NAME,
            &message,
            QoSWithPacketIdentifier::Level0,
        )?;
        delay.delay_ms(10 * 1000_u32);
    }
}
```
{% endraw %}

After the Wifi connection is established, we call `mqtt_connect` to perform
the MQTT handshake, and if all goes fine, it will give us back a `TcpStream`.

We then re-use the `TcpStream` to publish MQTT messages every 10 seconds.

A quick re-flash with the new code and messages should start appearing on the
other side.

```sh
cargo build
espflash <SERIAL-PORT> target/xtensa-esp32-espidf/debug/esp32_mqtt_publish
espmonitor <SERIAL-PORT>
```

## The code is on GitHub

All the code shown in this article is also available in GitHub:
<https://github.com/mihai-dinculescu/esp32-mqtt-publish>.

## Conclusion

This is the minimal code you need to write to publish messages to MQTT in Rust
on an ESP32 microcontroller. It's possible, and it works pretty well!

In a real-life use case, you would probably want to create yourself an MQTT
Client wrapper, which you'll then hopefully publish to
[crates.io](https://crates.io/) so that we can all benefit ❤

{{<ai_disclaimer />}}
