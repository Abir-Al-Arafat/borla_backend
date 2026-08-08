# Securely Connecting to MongoDB on AWS EC2 via SSM

This document outlines the standard operating procedure for securely tunneling into the EC2 MongoDB database (`borla_db`) using AWS Systems Manager (SSM). This method bypasses the need for SSH `.pem` files by utilizing IAM credentials (`abir-developer` access keys).

## Prerequisites

1.  **AWS CLI Configured:** Ensure your local machine (`betopia`) has the AWS CLI configured with your IAM Access Key and Secret Access Key (`aws configure`).
2.  **SSM Plugin Installed:** The AWS Session Manager Plugin must be installed on your local machine.
3.  **EC2 IAM Role:** The target EC2 instance must have an IAM role attached that includes the `AmazonSSMManagedInstanceCore` policy.

---

## Step 1: Ensure SSM Agent is Running on EC2

Ubuntu instances often manage the SSM agent via `snap` rather than traditional `apt`/`dpkg` packages. If the agent is unresponsive or needs to refresh its IAM permissions, you must restart it.

**Run on the EC2 terminal (`ubuntu@ip-172-31-4-74`):**
```bash
sudo snap restart amazon-ssm-agent
```

## Step 2: Start the SSM Port Forwarding Session

From your local machine, initiate the port forwarding tunnel. This securely routes traffic from your local port 27017 to the EC2 instance's internal port 27017.

**Run on your local terminal (`abir@betopia`):**
```bash
aws ssm start-session \
    --target i-0b948832d86542123 \
    --document-name AWS-StartPortForwardingSession \
    --parameters "portNumber=27017,localPortNumber=27017"
```

*Note: Keep this terminal window open. Closing it or pressing `Ctrl+C` will sever the database connection.*

## Step 3: Connect via MongoDB Compass

With the tunnel active, MongoDB Compass can connect to the remote database as if it were running locally.

1. Open MongoDB Compass.
2. In the URI input, paste the following connection string:
   ```text
   mongodb://localhost:27017/borla_db?directConnection=true
   ```
3. Leave all SSH and Proxy settings blank.
4. Click **Connect**.

*Crucial Detail:* The `?directConnection=true` flag is mandatory because the database is part of a replica set. Without it, Compass will attempt to auto-discover other nodes using their private AWS IPs, which will fail over the tunnel.

---

## Troubleshooting & Common Errors

### Error 1: `TargetNotConnected`
*   **Symptom:** Running the `start-session` command returns `An error occurred (TargetNotConnected)... is not connected.`
*   **Cause:** 
    1. The EC2 instance does not have the `AmazonSSMManagedInstanceCore` IAM role attached.
    2. The SSM agent on the server crashed or hasn't recognized newly attached IAM roles.
*   **Solution:** Verify the IAM role is attached in the AWS Console. Then, access the server terminal and run `sudo snap restart amazon-ssm-agent`. Wait 30 seconds and try the local command again.

### Error 2: `amazon-ssm-agent.deb: No such file or directory` or `Unit not found`
*   **Symptom:** Trying to install the agent via `wget` and `dpkg` fails, or `sudo systemctl restart amazon-ssm-agent` says the unit does not exist.
*   **Cause:** On modern Ubuntu AMIs, the SSM agent is pre-installed as a `snap` package, not a `systemd` service.
*   **Solution:** Do not attempt to download or install the `.deb` file. Manage the service strictly using `sudo snap restart amazon-ssm-agent`.

### Error 3: Connection Timeout in Compass
*   **Symptom:** The SSM tunnel says "Starting session...", but Compass spins indefinitely and times out.
*   **Cause:** The connection string is missing `directConnection=true`, causing Compass to route traffic outside of the secure `localhost` tunnel to the private AWS IP (`172.31.4.74`).
*   **Solution:** Double-check the connection string in Compass. Ensure it is exactly `mongodb://localhost:27017/borla_db?directConnection=true`.
