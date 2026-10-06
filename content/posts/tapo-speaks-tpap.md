+++
title = "tapo speaks TPAP: Third-Party Compatibility can stay off"
date = 2026-10-06
description = "tapo now logs in over the TPAP protocol, so the Third-Party Compatibility switch in the Tapo app can stay off. Also new: H200 and H500 camera hubs with recording downloads, and plug schedules and timers."

[taxonomies]
tags = ["rust", "python", "tapo", "iot", "home-automation", "mcp"]

[extra]
comment = true
read_time = true
+++

Your script has been switching a Tapo plug on and off for months. Then the plug
quietly updates its firmware, and the next request comes back with
`403 Forbidden`. Nothing in your code changed.

The cause is a switch called "Third-Party Compatibility", tucked away in the
Tapo app under Me > Third-Party Services. Since firmware 1.4.0, a plug only
talks to third-party clients the way it used to while that switch is on. It
has tripped people up again and again. At least nine issues tell the same
story, among them
[#441](https://github.com/mihai-dinculescu/tapo/issues/441),
[#449](https://github.com/mihai-dinculescu/tapo/issues/449) and
[#473](https://github.com/mihai-dinculescu/tapo/issues/473).

As of v0.11.1 of [tapo](https://github.com/mihai-dinculescu/tapo), my
unofficial Rust and Python client for TP-Link Tapo devices, the switch can
stay off, with minor exceptions that are covered below.

That's the headline of nearly four months of work, which landed in three
releases within a week of each other: v0.10.0 on 28 September, v0.11.0 on 2
October and v0.11.1 on 4 October. Along the way the library also gained a new
family of devices and two features of the Tapo app that people had been asking
for. The
[changelog](https://github.com/mihai-dinculescu/tapo/blob/main/CHANGELOG.md)
has every detail. This post covers the highlights, with examples.

Everything here applies to both the Rust and the Python versions of the
library. The Python package is a thin wrapper around the Rust crate, so every
change lands in both at once, under the same version number. The examples
below are in Rust, and the Python calls mirror them.

## How we got here

This is the third time in three years that a security change has quietly
locked third-party clients out of Tapo devices. The switch is what the second
time left behind.

**2023: lights and plugs.** That February, three researchers from the
University of Catania and Royal Holloway, University of London
[reported four flaws](https://www.dmi.unict.it/giamp/smartbulbscanbehackedtohackintoyourhousehold/)
in the way Tapo devices talked to the app, starting from an L530E bulb.
Someone within range could take over the victim's Tapo account and learn their
Wi-Fi password. A few months later, firmware updates began swapping the
devices' original AES protocol for a new one, KLAP. TP-Link never said the two
were connected, and it didn't announce the change either. "Is this an error or
intentional? If intentional, WHY?" asked
[one forum thread](https://community.tp-link.com/us/smart-home/forum/topic/620314),
which was locked without an answer from TP-Link. Every third-party client,
this library included, had to learn KLAP.

**2024: cameras.** In November 2023, Juraj Nyíri, who maintains a Home
Assistant integration for Tapo cameras, reported a vulnerability to TP-Link.
TP-Link fixed it, and by April 2024 cameras on new firmware had stopped
accepting the integration's login. Nyíri built a workaround that went through
TP-Link's cloud and asked for permission to release it. TP-Link reviewed the
code and said no. What it shipped instead, in December 2024, eight months
after the first reports, was a toggle in the Tapo app that turns the old local
login back on: Third-Party Compatibility. The integration's release notes
called it
[a victory for local control](https://github.com/JurajNyiri/HomeAssistant-Tapo-Control/releases/tag/6.0.0).

**2025: plugs and lights again.** In October 2025, firmware 1.4.0 brought
another new protocol, TPAP, and put plugs behind the same switch. Lights
followed in the first half of 2026, on firmware 1.4.1 to 1.4.3. This time the
way out existed before the door closed: the switch had been in the Tapo app
since December 2024. But it was off by default. TP-Link's
[FAQ](https://www.tp-link.com/us/support/faq/4416/) says
the feature "is disabled by default to ensure security", and that switching it
on "may reduce the security of your devices". When owners of freshly broken
plugs asked on the forum, they were told that Home Assistant
"[is not an officially supported third‑party platform](https://community.tp-link.com/en/smart-home/forum/topic/852002)
for Tapo products". TPAP itself was never documented.

The switch is a security downgrade with a friendly name. Turning it on brings
back the old login in place of the new one, and the new one is better. More on
that below.

## TPAP support

On recent Tapo firmware, the Third-Party Compatibility switch decides which
protocol a device speaks. A light, plug, power strip or H100 hub speaks KLAP
when it's on, and TPAP when it's off. Cameras never spoke KLAP. Their older
protocol is AES SSL, and some of them refuse that one when the switch is off.
The library didn't speak TPAP, so it could only reach a device whose switch
was on.

v0.11.1 adds TPAP. Lights, plugs, power strips, hubs and cameras that require
it can now be used with the switch off, both when connecting by IP
address and through `discover_devices`. There is nothing to change in your
code: the client works out which protocol the device speaks and logs in over
that one.

Three things are worth knowing:

- **A wrong password can lock the device.** After too many failed logins a
  TPAP device refuses every login for a while. The library reports the wrong
  password as `TPAP_CREDENTIALS` and the lockout as `TPAP_AUTH_ATTEMPTS_LIMIT`.
  Don't retry either of them in a loop.
- **Camera hubs don't speak TPAP yet.** An H200 (new in v0.10, see below) on
  firmware 1.7.5 announces AES SSL whether the switch is on or off, and the
  library logs in over that.
- **Some cameras don't speak TPAP yet either.** It depends on the model and its
  firmware. A C220 and a C510W on firmware 1.3.4 speak TPAP, so they work with
  the switch off. A C210 on firmware 1.5.2 doesn't, so the library logs in to
  it over AES SSL instead, and the camera refuses that login while the switch
  is off. For now it only works with the switch on.

While one protocol arrived, another left. The original AES protocol, the one
KLAP replaced in 2023, was still in the library, which probed every light and
plug it connected to by IP address to find out whether it wanted that or KLAP.
No firmware has shipped with it for a long time, so v0.11.0 removes it.
AES SSL, the one cameras and camera hubs speak, is a close relative: the same
kind of encrypted envelope, but over HTTPS and with a different login. That
one stays.

### Why TPAP is the safer protocol

Being able to ignore a switch is nice. The more interesting part is how TPAP
logs in.

KLAP proves that both sides know your credentials by exchanging hashes built
from them and from two random values sent in the clear. That keeps the
password itself off the wire, but anyone who records a single login on your
network can take it home and test password guesses against it, as fast as
their hardware allows. The session keys come from the same ingredients, so a
correct guess also decrypts everything that followed.

TPAP logs in with SPAKE2+
([RFC 9383](https://www.rfc-editor.org/rfc/rfc9383)), a password-authenticated
key exchange. Two things change:

- **A recorded login is useless for guessing.** Nothing in the exchange can be
  checked against a candidate password offline. The only way to test a guess
  is to try it against the device itself, one attempt at a time, and that's
  exactly what the lockout mentioned above puts a stop to.
- **Recorded traffic stays private.** Each session's keys depend on secrets
  that both sides make up for that login and never send. Someone who learns
  the password later still can't decrypt the sessions they captured before.

While the switch is on, a light or plug still advertises KLAP and that's what
the library logs in over, so these two only hold once it's off. If nothing
else on your network needs Third-Party Compatibility, there is now a good
reason to switch it off.

## Also new

TPAP is the big change, but it's not the only one.

### Camera hubs: H200 and H500

Until v0.10, the only hub the library could talk to was the H100. The H200 and
H500 are a different kind of beast. They pair with sensors and switches like
the H100 does, but they also pair with cameras and store their recordings.

Both now have a handler, created with `h200` or `h500` on the `ApiClient`.
`discover_devices` finds them too, and returns them ready to use instead of
reporting an error.

The sensors and switches paired to a camera hub work exactly as they do on the
H100, through `get_child_device_list` and the typed child handlers (`t100`,
`t31x` and the rest). The new part is the recordings: you can list the cameras
paired to the hub, find the days that have recordings, list the recordings in a
time range, and download one as a playable MPEG-TS clip.

```rust
use tapo::ApiClient;

let hub = ApiClient::new("<tapo-username>", "<tapo-password>")
    .h200("<hub ip address>")
    .await?;

let end_time = chrono::Utc::now();
let start_time = end_time - chrono::Duration::days(7);

for camera in hub.get_general_device_list().await? {
    if !camera.hub_storage_enabled {
        continue;
    }

    let recordings = hub
        .get_recordings(camera.device_id.clone(), start_time, end_time)
        .await?;

    if let Some(recording) = recordings.first() {
        let mut media = Vec::new();
        hub.download_recording(
            camera.device_id.clone(),
            recording.start_time,
            recording.end_time,
            &mut media,
        )
        .await?;

        std::fs::write("recording.ts", &media)?;
    }
}
```

`download_recording` writes to any `AsyncWrite`, so the clip can go to a
buffer, as above, or straight to a file. In Python it takes a file path
instead. All the times are UTC: `DateTime<Utc>` in Rust and timezone-aware
`datetime`s in Python.

The full examples are in the repository, for
[Rust](https://github.com/mihai-dinculescu/tapo/blob/main/tapo/examples/tapo_h200.rs)
and for
[Python](https://github.com/mihai-dinculescu/tapo/blob/main/tapo-py/examples/tapo_h200.py).

I don't own either hub, so none of this would exist without
[@dominiquefournier](https://github.com/dominiquefournier), who stuck with it
through roughly thirty rounds of testing against their own H200, and
[@supermimai](https://github.com/supermimai), who tested it against their
H500. Thank you both.

### Plug schedules and timers

The Tapo app has had "Schedule" and "Timer" for plugs since forever. As of
v0.10 the library has them too, on `PlugHandler` and
`PlugEnergyMonitoringHandler`. Both were contributed by
[@Hueburtsonly](https://github.com/Hueburtsonly).

A schedule rule fires at a time of day, or at an offset from sunrise or sunset,
either once or on a set of weekdays. The rules live on the plug and fire on its
own clock, so they keep working when your script, your server or your internet
connection is down.

```rust
use tapo::ApiClient;
use tapo::requests::{DaysOfWeek, ScheduleRule};
use tapo::responses::PowerState;

let device = ApiClient::new("<tapo-username>", "<tapo-password>")
    .p110("<device ip address>")
    .await?;

// Off at 23:30 on Mondays and Wednesdays.
let rule =
    ScheduleRule::clock_weekly(23, 30, DaysOfWeek::MON | DaysOfWeek::WED, PowerState::Off)?;
let late_night = device.add_schedule_rule(rule).await?;

// On every day, an hour after sunset.
let rule = ScheduleRule::sunset_weekly(60, DaysOfWeek::EVERY_DAY, PowerState::On)?;
device.add_schedule_rule(rule).await?;

// Off on weekdays, 30 minutes before sunrise.
let rule = ScheduleRule::sunrise_weekly(-30, DaysOfWeek::WEEKDAYS, PowerState::Off)?;
device.add_schedule_rule(rule).await?;

// Rules read back from the device are read-only. `to_editable` turns one into
// a rule that can be changed and sent back.
let edit = late_night.to_editable()?.with_enabled(false);
device.edit_schedule_rule(edit).await?;
```

There are also `clock_once`, `sunrise_once` and `sunset_once` for rules that
fire a single time, `get_schedule_rules` and `get_max_schedule_rules` to see
what's on the device and how much room is left, and `remove_schedule_rule` and
`remove_all_schedule_rules` to clean up.

The timer is the simpler sibling: `set_timer` arms a single countdown, between
one second and 24 hours, after which the plug switches on or off. `get_timer`
reads it back and `clear_timer` cancels it. A plug holds one armed timer at a
time, so `set_timer` replaces whatever was armed before.

### The MCP server

[tapo-mcp](https://github.com/mihai-dinculescu/tapo/tree/main/tapo-mcp), the
MCP server that exposes Tapo devices to AI agents, picked up two of these
changes. As of v0.5.3 it lists H200 and H500 camera hubs and the sensors paired
to them, and it works with devices that have Third-Party Compatibility switched
off. Plug schedules, timers and recording downloads are library-only for now.

## Before you upgrade

Coming from v0.9, expect a few breaking changes. The legacy AES protocol is
gone, trigger logs and temperature records have new field names, and Python
enum values no longer compare equal to integers. The
[changelog](https://github.com/mihai-dinculescu/tapo/blob/main/CHANGELOG.md)
lists every one.

## What's next

A few things are on the list:

- **A lot more in the MCP server.** Energy usage and caching of discovery
  results come first, and recording downloads could follow if there's interest.
- **The H110 hub.** [@skoky](https://github.com/skoky) has a
  [pull request](https://github.com/mihai-dinculescu/tapo/pull/607) in
  progress that adds the H110, the hub that doubles as an infrared remote
  control.
- **More cameras.** Today the library only has a handler for cameras that pan
  and tilt. The plan is to add one for fixed cameras, starting with the
  ubiquitous C120.
- **A device simulator.** I really want to get better at testing. Today most
  of the library can only be checked against real hardware, and some of that
  hardware, like the camera hubs, I don't own. A simulator that answers the
  way the devices do would catch a broken login or a misread response before
  a tester has to.
- **A Node.js wrapper, perhaps.** This one is long term and not a promise. The
  same approach that produced the Python package could bring the library to
  Node.js.

In the meantime, if this library was your only reason for keeping Third-Party
Compatibility on, upgrade and switch it off. If a device then refuses to log
in, [open an issue](https://github.com/mihai-dinculescu/tapo/issues) with its
model and firmware. Reports like that are how the C210 got its caveat, and how
the H200 got supported at all.

{{<ai_disclaimer />}}
