+++
title = "Raise the minimum size of an EKS node group"
date = 2026-09-24
description = "EKS rejects a minimum above the current desired size, so raise the desired size first or in the same call."

[taxonomies]
tags = ["eks"]

[extra]
comment = true
+++

A managed node group's scaling config has three numbers:

- `desiredSize` is the number of nodes right now. With the Cluster Autoscaler
  it moves on its own, up on pending pods and down on idle nodes, and
  [AWS says not to change it by hand](https://docs.aws.amazon.com/eks/latest/APIReference/API_NodegroupScalingConfig.html).
- `minSize` is the floor the autoscaler will not scale below.
- `maxSize` is the ceiling it will not scale above.

The autoscaler never touches the floor or the ceiling; those are yours. To
keep spare capacity around, such as headroom for bursty deployments, raise
`minSize` and the autoscaler stops taking those nodes away.

The catch: EKS validates `minSize <= desiredSize <= maxSize` against the
desired size as it is right now. It does not lift the desired size to meet a
new minimum the way a bare Auto Scaling group does, which has been
[an open request since 2022](https://github.com/aws/containers-roadmap/issues/1637).
Raising the minimum above the current desired size fails:

```text
InvalidParameterException: Minimum capacity 100 can't be greater than desired size 60
```

So the desired size has to go up first, or in the same call:

```sh
aws eks update-nodegroup-config \
  --cluster-name my-cluster \
  --nodegroup-name my-nodegroup \
  --scaling-config minSize=100,desiredSize=100,maxSize=200
```

In Terraform the usual `ignore_changes = [scaling_config[0].desired_size]`
makes this worse: Terraform keeps sending the desired size it last read, so
bumping `desired_size` next to `min_size` in the config changes nothing and
the apply fails with the same error. Run the CLI command above, then put the
same `min_size` in the config so the next plan is clean. Raising only the
desired size from the CLI and letting Terraform raise the floor leaves a
window: by default the autoscaler starts removing idle nodes after about ten
minutes.

The same rule applies at the top: a `maxSize` below the current desired size
is rejected too.
